import { create } from 'zustand';
import { type CellCoord, START_BOUNDS, cellKey } from './grid';
import { type RuleCheck, canDemolish as canDemolishGeometry, canPlace as canPlaceGeometry } from './structure';
import { BLOCKS, BLOCK_REGISTRY, type BlockDef } from './blocks';
import { tick as runTick } from './tick';
import type { EconomyStats } from './economy';
import { MAX_HEIGHT } from './grid';

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
  credits: number
): RuleCheck {
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

  setActiveBlock: (blockId: string) => void;
  togglePaused: () => void;
  placeCell: (coord: CellCoord) => RuleCheck;
  removeCell: (coord: CellCoord) => RuleCheck;
  advanceTick: () => void;
  setFloorSlice: (floor: number) => void;
  toggleXray: () => void;
  setOverlayMode: (mode: OverlayMode) => void;
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

  setFloorSlice: (floor) => set({ floorSlice: Math.max(0, Math.min(MAX_HEIGHT - 1, Math.round(floor))) }),
  toggleXray: () => set((s) => ({ xray: !s.xray })),
  setOverlayMode: (mode) => set({ overlayMode: mode }),

  setActiveBlock: (blockId) => {
    if (BLOCK_REGISTRY[blockId]) set({ activeBlockId: blockId });
  },

  togglePaused: () => set((s) => ({ paused: !s.paused })),

  placeCell: (coord) => {
    const { cells, bounds, credits, activeBlockId } = get();
    const block = BLOCK_REGISTRY[activeBlockId];
    const check = checkPlacement(cells, coord, bounds, block, credits);
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
    const { cells, population, credits, tickCount } = get();
    const result = runTick({ cells, population, credits }, BLOCK_REGISTRY);
    set({
      population: result.population,
      credits: result.credits,
      stats: result.stats,
      tickCount: tickCount + 1,
    });
  },
}));
