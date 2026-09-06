// 자원 수지·파생 지표·인구 수렴. three.js 비의존.
//
// §4.2 공식을 따르되, 소음/오염의 공간적 감쇠 전파처럼 콘텐츠(블록 종류, 위치
// 밸런스)가 갖춰져야 의미가 생기는 부분은 v1에서 전역 합산으로 단순화했다.
// 아래 상수들은 전부 "밸런스 패스(M6)" 전까지의 임시값이다.

import type { CellCoord } from './grid';
import { parseCellKey } from './grid';
import type { BlockDef } from './blocks';
import type { AccessResult } from './access';
import { averageWalkCost } from './access';
import { exposedFaceCount, makeLightwellOpenCheck } from './light';
import { lightAppealDelta } from './light';
import type { CellEffects } from './adjacency';
import { getCellEffects } from './adjacency';

export interface CellRecord {
  blockId: string;
}

export const BASE_APPEAL = 10;
export const BASE_ORDER = 50;

const APPEAL_WEIGHTS = {
  pollution: 0.4,
  noise: 0.3,
  walkCost: 1.2,
  lightSatisfaction: 15,
} as const;

const ORDER_WEIGHTS = {
  populationPressure: 0.5,
  pollution: 0.3,
  darkCellRatio: 20,
} as const;

const CAPACITY_MULTIPLIER_MIN = 0.2;
const CAPACITY_MULTIPLIER_MAX = 1.5;
// [밸런스 패스, M6] 애초 피벗 100은 시작 매력(주택 하나 없이도 약 25, 빛 충족
// 보너스 때문에)에서 배율이 0.25로 잡혀, 티어1(인구 12) 하나 해금하는 데도
// 주택을 열 채 넘게 지어야 했다. 50으로 낮춰 초기 매력대에서 체감 성장이
// 나오게 한다.
const CAPACITY_MULTIPLIER_PIVOT = 50; // appeal 50 = 배율 1.0

// 인구는 천천히 들어오고 빠르게 나간다 [확정, §4.2].
export const POP_INFLOW_RATE = 0.04;
export const POP_OUTFLOW_RATE = 0.35;

export interface ResourceBalance {
  supply: number;
  demand: number;
  balance: number;
}

export interface EconomyStats {
  power: ResourceBalance;
  water: ResourceBalance;
  pollution: number;
  noise: number;
  order: number;
  appeal: number;
  jobs: number;
  income: number;
  housingCapacityRaw: number;
  housingCapacity: number;
  averageWalkCost: number;
  darkCellCount: number;
  isolatedCellCount: number;
  totalCellCount: number;
  lightSatisfaction: number;
}

function resourceBalance(flow: number): { supply: number; demand: number } {
  return flow >= 0 ? { supply: flow, demand: 0 } : { supply: 0, demand: -flow };
}

function capacityMultiplier(appeal: number): number {
  const raw = appeal / CAPACITY_MULTIPLIER_PIVOT;
  return Math.min(CAPACITY_MULTIPLIER_MAX, Math.max(CAPACITY_MULTIPLIER_MIN, raw));
}

export interface PermanentModifiers {
  appeal: number;
  order: number;
}

export interface ComputeEconomyInputs {
  cells: ReadonlyMap<string, CellRecord>;
  blocks: Readonly<Record<string, BlockDef>>;
  access: AccessResult;
  synergy: ReadonlyMap<string, CellEffects>;
  population: number;
  // 이벤트 선택지에서 온 영구 효과 [§8.1 modifiers]. 매력에 반영되어야 수용력에도
  // 정상적으로 파급되므로, 사후에 더하지 않고 여기서 합산에 포함시킨다.
  modifiers?: PermanentModifiers;
}

export function computeEconomyStats(inputs: ComputeEconomyInputs): EconomyStats {
  const { cells, blocks, access, synergy, population, modifiers } = inputs;

  let powerSupply = 0;
  let powerDemand = 0;
  let waterSupply = 0;
  let waterDemand = 0;
  let pollution = 0;
  let noise = 0;
  let orderDelta = 0;
  let jobs = 0;
  let income = 0;
  let housingCapacityRaw = 0;
  let appealSum = 0;
  let darkCellCount = 0;
  let needsLightTotal = 0;
  let needsLightLit = 0;
  let pollutionDelta = 0;
  const isOpen = makeLightwellOpenCheck(cells, blocks);

  for (const [key, record] of cells) {
    const block = blocks[record.blockId];
    if (!block) continue;

    const coord: CellCoord = parseCellKey(key);
    const isDark = exposedFaceCount(cells, coord, isOpen) === 0;
    if (isDark) darkCellCount++;
    if (block.lightPref === 'NEEDS_LIGHT') {
      needsLightTotal++;
      if (!isDark) needsLightLit++;
    }

    pollution += block.emits.pollution ?? 0;
    noise += block.emits.noise ?? 0;

    const isolated = access.isolated.has(key);
    if (isolated) continue; // 고립된 셀은 생산하지 않는다 [확정, §3.2]

    const effects = getCellEffects(synergy, key);

    const { supply: powerCellSupply, demand: powerCellDemand } = resourceBalance(block.flows.power ?? 0);
    const { supply: waterCellSupply, demand: waterCellDemand } = resourceBalance(block.flows.water ?? 0);
    powerSupply += powerCellSupply;
    powerDemand += powerCellDemand;
    waterSupply += waterCellSupply;
    waterDemand += waterCellDemand;
    jobs += block.provides.jobs ?? 0;
    income += (block.provides.income ?? 0) * effects.incomeMultiplier;
    housingCapacityRaw += block.provides.housing ?? 0;
    orderDelta += (block.provides.order ?? 0) + effects.orderDelta;
    appealSum += (block.provides.appeal ?? 0) + effects.appealDelta + lightAppealDelta(isDark, block.lightPref);
    pollutionDelta += effects.pollutionDelta;
  }

  pollution = Math.max(0, pollution + pollutionDelta);
  const totalCellCount = cells.size;
  const isolatedCellCount = access.isolated.size;
  const walkCost = averageWalkCost(access);
  const lightSatisfaction = needsLightTotal === 0 ? 1 : needsLightLit / needsLightTotal;
  const darkCellRatio = totalCellCount === 0 ? 0 : darkCellCount / totalCellCount;
  const populationPressure = Math.max(0, population - housingCapacityRaw);

  const appeal =
    BASE_APPEAL +
    appealSum +
    (modifiers?.appeal ?? 0) -
    pollution * APPEAL_WEIGHTS.pollution -
    noise * APPEAL_WEIGHTS.noise -
    walkCost * APPEAL_WEIGHTS.walkCost +
    lightSatisfaction * APPEAL_WEIGHTS.lightSatisfaction;

  const order =
    BASE_ORDER +
    orderDelta +
    (modifiers?.order ?? 0) -
    populationPressure * ORDER_WEIGHTS.populationPressure -
    pollution * ORDER_WEIGHTS.pollution -
    darkCellRatio * ORDER_WEIGHTS.darkCellRatio;

  const housingCapacity = housingCapacityRaw * capacityMultiplier(appeal);

  return {
    power: { supply: powerSupply, demand: powerDemand, balance: powerSupply - powerDemand },
    water: { supply: waterSupply, demand: waterDemand, balance: waterSupply - waterDemand },
    pollution,
    noise,
    order,
    appeal,
    jobs,
    income,
    housingCapacityRaw,
    housingCapacity,
    averageWalkCost: walkCost,
    lightSatisfaction,
    darkCellCount,
    isolatedCellCount,
    totalCellCount,
  };
}

// 인구는 수용력을 향해 점진 수렴한다. 급락은 빠르게, 유입은 느리게 [확정].
export function stepPopulation(currentPopulation: number, housingCapacity: number): number {
  const gap = housingCapacity - currentPopulation;
  const rate = gap >= 0 ? POP_INFLOW_RATE : POP_OUTFLOW_RATE;
  return Math.max(0, currentPopulation + gap * rate);
}
