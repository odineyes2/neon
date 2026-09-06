// 이벤트 조건 DSL이 참조할 수 있는 평평한 숫자 지표 모음. three.js 비의존.

import type { BlockDef } from './blocks';
import type { EconomyStats } from './economy';
import { countOverloadedCells } from './structure';
import { maxBuiltFloor } from './tiers';

export interface CellRecord {
  blockId: string;
}

export interface BuildEventContextParams {
  cells: ReadonlyMap<string, CellRecord>;
  blocks: Readonly<Record<string, BlockDef>>;
  stats: EconomyStats;
  population: number;
  credits: number;
  tickCount: number;
}

// 특정 블록의 존재 여부를 조건에서 쓰기 위한 0/1 플래그.
const PRESENCE_BLOCK_IDS = ['cargo_elevator', 'alley_shrine', 'nightclub', 'black_market', 'megabuilding_core'] as const;

export function buildEventContext(params: BuildEventContextParams): Record<string, number> {
  const { cells, blocks, stats, population, credits, tickCount } = params;

  const overloaded = countOverloadedCells(cells, blocks);
  const presence: Record<string, number> = {};
  for (const id of PRESENCE_BLOCK_IDS) presence[id] = 0;

  for (const record of cells.values()) {
    if ((PRESENCE_BLOCK_IDS as readonly string[]).includes(record.blockId)) {
      presence[record.blockId] = 1;
    }
  }

  return {
    population,
    credits,
    day: Math.floor(tickCount / 24) + 1,
    darkCells: stats.darkCellCount,
    isolatedCells: stats.isolatedCellCount,
    overloaded,
    order: stats.order,
    appeal: stats.appeal,
    walkCost: stats.averageWalkCost,
    lightSatisfaction: stats.lightSatisfaction,
    builtFloors: maxBuiltFloor(cells),
    totalCells: stats.totalCellCount,
    powerBalance: stats.power.balance,
    waterBalance: stats.water.balance,
    hasElevator: presence.cargo_elevator,
    hasShrine: presence.alley_shrine,
    hasNightclub: presence.nightclub,
    hasBlackMarket: presence.black_market,
    hasMegabuildingCore: presence.megabuilding_core,
  };
}
