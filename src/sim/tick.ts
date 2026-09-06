// 틱 오케스트레이션: 접근성 -> 시너지 -> 경제 -> 인구 수렴 -> 이벤트 판정 순서로
// 한 시간을 진행한다. three.js 비의존.

import type { BlockDef } from './blocks';
import { computeAccess } from './access';
import { computeSynergyEffects } from './adjacency';
import { type EconomyStats, type PermanentModifiers, computeEconomyStats, stepPopulation } from './economy';
import { buildEventContext } from './eventContext';
import { EVENTS, findTriggeredEvent, type EventDef } from './events';

const TICKS_PER_DAY = 24;

export interface CellRecord {
  blockId: string;
}

export interface TickState {
  cells: ReadonlyMap<string, CellRecord>;
  population: number;
  credits: number;
  modifiers: PermanentModifiers;
  eventFlags: ReadonlySet<string>;
  firedEventIds: ReadonlySet<string>;
  tickCount: number;
}

export interface TickResult {
  population: number;
  credits: number;
  stats: EconomyStats;
  isolatedCells: ReadonlySet<string>;
  triggeredEvent: EventDef | null;
}

export function tick(state: TickState, blocks: Readonly<Record<string, BlockDef>>): TickResult {
  const access = computeAccess(state.cells, blocks);
  const synergy = computeSynergyEffects(state.cells, blocks);
  const stats = computeEconomyStats({
    cells: state.cells,
    blocks,
    access,
    synergy,
    population: state.population,
    modifiers: state.modifiers,
  });

  const population = stepPopulation(state.population, stats.housingCapacity);

  let upkeep = 0;
  for (const record of state.cells.values()) {
    upkeep += blocks[record.blockId]?.upkeep ?? 0;
  }

  // provides.income / upkeep는 하루 단위 값으로 정의하고, 틱(1시간)마다 1/24씩 정산한다.
  const netCreditsPerTick = (stats.income - upkeep) / TICKS_PER_DAY;
  const credits = state.credits + netCreditsPerTick;

  const eventContext = buildEventContext({
    cells: state.cells,
    blocks,
    stats,
    population,
    credits,
    tickCount: state.tickCount,
  });
  const triggeredEvent = findTriggeredEvent(EVENTS, eventContext, state.eventFlags, state.firedEventIds);

  return { population, credits, stats, isolatedCells: access.isolated, triggeredEvent };
}
