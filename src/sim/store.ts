import { create } from 'zustand';
import { type CellCoord, START_BOUNDS, cellKey } from './grid';
import { type RuleCheck, canDemolish as canDemolishGeometry, canPlace as canPlaceGeometry } from './structure';
import { BLOCKS, BLOCK_REGISTRY, type BlockDef } from './blocks';
import { tick as runTick } from './tick';
import type { EconomyStats, PermanentModifiers } from './economy';
import { MAX_HEIGHT } from './grid';
import { TIER_UNLOCK_POPULATION, isTierUnlocked, maxBuiltFloor } from './tiers';
import type { EventDef } from './events';
import {
  CHARACTERS,
  CHARACTER_REGISTRY,
  type CharacterRoster,
  advanceQuests,
  processDepartures,
  tryRecruit,
} from './characters';

export type OverlayMode = 'none' | 'light' | 'access' | 'load' | 'noise' | 'pollution';

export interface CellRecord {
  blockId: string;
}

const STARTING_CREDITS = 1000;

export function checkPlacement(
  cells: ReadonlyMap<string, CellRecord>,
  coord: CellCoord,
  bounds: { x: number; z: number },
  block: BlockDef,
  credits: number,
  population: number
): RuleCheck {
  if (!isTierUnlocked(block.tier, population, maxBuiltFloor(cells))) {
    const need = TIER_UNLOCK_POPULATION[block.tier];
    return { allowed: false, reason: `${block.name}은(는) 아직 해금되지 않았다 (인구 ${need} 필요)` };
  }

  const belowKey = cellKey({ x: coord.x, y: coord.y - 1, z: coord.z });
  const belowRecord = cells.get(belowKey);
  if (belowRecord) {
    const belowBlock = BLOCK_REGISTRY[belowRecord.blockId];
    if (belowBlock?.roofOnly) {
      return { allowed: false, reason: `${belowBlock.name} 위에는 지을 수 없다 (옥상 전용)` };
    }
  }

  const geometryCheck = canPlaceGeometry(cells, coord, bounds);
  if (!geometryCheck.allowed) return geometryCheck;

  if (credits < block.cost) {
    return { allowed: false, reason: `크레딧이 부족하다 (${block.cost} 필요, 보유 ${Math.floor(credits)})` };
  }

  return { allowed: true };
}

interface GameStore {
  cells: ReadonlyMap<string, CellRecord>;
  bounds: { x: number; z: number };
  credits: number;
  population: number;
  tickCount: number;
  stats: EconomyStats | null;
  activeBlockId: string;
  paused: boolean;

  // M4: 오버레이·UX
  floorSlice: number; // 이 층까지만 보인다 (0 ~ MAX_HEIGHT-1)
  xray: boolean;
  overlayMode: OverlayMode;

  // M5: 이벤트
  eventFlags: ReadonlySet<string>;
  firedEventIds: ReadonlySet<string>;
  modifiers: PermanentModifiers;
  pendingEvent: EventDef | null;
  characterRoster: CharacterRoster;
  departedCharacterIds: ReadonlySet<string>; // 한 번 떠나면 다시 합류하지 않는다
  departureNotice: string[]; // 이번 틱에 떠난 캐릭터 이름 (UI가 소비 후 비운다)

  setActiveBlock: (blockId: string) => void;
  togglePaused: () => void;
  placeCell: (coord: CellCoord) => RuleCheck;
  removeCell: (coord: CellCoord) => RuleCheck;
  advanceTick: () => void;
  setFloorSlice: (floor: number) => void;
  toggleXray: () => void;
  setOverlayMode: (mode: OverlayMode) => void;
  resolveEvent: (choiceIndex: number) => void;
  clearDepartureNotice: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  cells: new Map<string, CellRecord>(),
  bounds: { x: START_BOUNDS.x, z: START_BOUNDS.z },
  credits: STARTING_CREDITS,
  population: 0,
  tickCount: 0,
  stats: null,
  activeBlockId: BLOCKS[0].id,
  paused: false,

  floorSlice: MAX_HEIGHT - 1,
  xray: false,
  overlayMode: 'none',

  eventFlags: new Set<string>(),
  firedEventIds: new Set<string>(),
  modifiers: { appeal: 0, order: 0 },
  pendingEvent: null,
  characterRoster: new Map(),
  departedCharacterIds: new Set(),
  departureNotice: [],

  clearDepartureNotice: () => set({ departureNotice: [] }),

  setFloorSlice: (floor) => set({ floorSlice: Math.max(0, Math.min(MAX_HEIGHT - 1, Math.round(floor))) }),
  toggleXray: () => set((s) => ({ xray: !s.xray })),
  setOverlayMode: (mode) => set({ overlayMode: mode }),

  setActiveBlock: (blockId) => {
    if (BLOCK_REGISTRY[blockId]) set({ activeBlockId: blockId });
  },

  togglePaused: () => set((s) => ({ paused: !s.paused })),

  placeCell: (coord) => {
    const { cells, bounds, credits, activeBlockId, population } = get();
    const block = BLOCK_REGISTRY[activeBlockId];
    const check = checkPlacement(cells, coord, bounds, block, credits, population);
    if (check.allowed) {
      const next = new Map(cells);
      next.set(cellKey(coord), { blockId: activeBlockId });
      set({ cells: next, credits: credits - block.cost });
    }
    return check;
  },

  removeCell: (coord) => {
    const { cells } = get();
    const check = canDemolishGeometry(cells, coord);
    if (check.allowed) {
      const next = new Map(cells);
      next.delete(cellKey(coord));
      set({ cells: next });
    }
    return check;
  },

  advanceTick: () => {
    const {
      cells,
      population,
      credits,
      tickCount,
      modifiers,
      eventFlags,
      firedEventIds,
      pendingEvent,
      characterRoster,
      departedCharacterIds,
    } = get();
    const result = runTick(
      { cells, population, credits, modifiers, eventFlags, firedEventIds, tickCount },
      BLOCK_REGISTRY
    );

    const nextTickCount = tickCount + 1;
    const { roster: afterDepartures, departedIds } = processDepartures(characterRoster, cells, result.isolatedCells);
    const nextDeparted =
      departedIds.length > 0 ? new Set([...departedCharacterIds, ...departedIds]) : departedCharacterIds;
    const afterRecruit = tryRecruit(
      CHARACTERS,
      afterDepartures,
      result.population,
      cells,
      BLOCK_REGISTRY,
      nextTickCount,
      nextDeparted
    );
    const nextRoster = advanceQuests(CHARACTERS, afterRecruit, nextTickCount);
    const departureNames = departedIds.map((id) => CHARACTER_REGISTRY[id]?.name ?? id);
    const nextPendingEvent = pendingEvent ?? result.triggeredEvent;
    const justTriggered = pendingEvent === null && nextPendingEvent !== null;

    set({
      population: result.population,
      credits: result.credits,
      stats: result.stats,
      tickCount: nextTickCount,
      // 이미 뜬 이벤트에 답하기 전까지는 다음 이벤트로 덮어쓰지 않는다.
      pendingEvent: nextPendingEvent,
      // 새 이벤트가 뜨면 읽을 시간을 주기 위해 자동으로 멈춘다.
      paused: justTriggered ? true : get().paused,
      characterRoster: nextRoster,
      departedCharacterIds: nextDeparted,
      departureNotice: departureNames.length > 0 ? [...get().departureNotice, ...departureNames] : get().departureNotice,
    });
  },

  resolveEvent: (choiceIndex) => {
    const { pendingEvent, credits, modifiers, eventFlags, firedEventIds } = get();
    if (!pendingEvent) return;
    const choice = pendingEvent.choices[choiceIndex];
    if (!choice) return;

    const cost = choice.cost?.credits ?? 0;
    if (cost > 0 && credits < cost) return; // 감당 못 할 유료 선택지는 고를 수 없다 (무료 선택지는 빚이 있어도 항상 가능)

    const nextFlags = new Set(eventFlags);
    if (choice.setFlag) nextFlags.add(choice.setFlag);

    set({
      credits: credits - cost + (choice.effects?.credits ?? 0),
      modifiers: {
        appeal: modifiers.appeal + (choice.effects?.appeal ?? 0),
        order: modifiers.order + (choice.effects?.order ?? 0),
      },
      eventFlags: nextFlags,
      firedEventIds: new Set(firedEventIds).add(pendingEvent.id),
      pendingEvent: null,
    });
  },
}));
