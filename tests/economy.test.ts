import { describe, expect, it } from 'vitest';
import { cellKey } from '../src/sim/grid';
import { computeAccess } from '../src/sim/access';
import { computeSynergyEffects } from '../src/sim/adjacency';
import { computeEconomyStats, stepPopulation } from '../src/sim/economy';
import type { BlockDef } from '../src/sim/blocks';

function makeBlock(overrides: Partial<BlockDef> & { id: string }): BlockDef {
  return {
    name: overrides.id,
    tier: 0,
    category: 'utility',
    cost: 0,
    upkeep: 0,
    weight: 0,
    structuralCapacity: 0,
    lightPref: 'INDIFFERENT',
    roofOnly: false,
    flows: {},
    provides: {},
    emits: {},
    visual: { base: '', facade: '', props: [] },
    description: '',
    ...overrides,
  };
}

const blocks: Record<string, BlockDef> = {
  housing: makeBlock({
    id: 'housing',
    category: 'residential',
    lightPref: 'NEEDS_LIGHT',
    flows: { power: -2, water: -2 },
    provides: { housing: 4 },
  }),
  generator: makeBlock({ id: 'generator', flows: { power: 12 }, emits: { pollution: 4 } }),
};

function stats(cellsInput: Array<[string, string]>, population = 0) {
  const cells = new Map(cellsInput.map(([key, blockId]) => [key, { blockId }]));
  const access = computeAccess(cells, blocks);
  const synergy = computeSynergyEffects(cells, blocks);
  return computeEconomyStats({ cells, blocks, access, synergy, population });
}

describe('computeEconomyStats', () => {
  it('sums power flows into a net balance', () => {
    const result = stats([
      [cellKey({ x: 0, y: 0, z: 0 }), 'generator'],
      [cellKey({ x: 1, y: 0, z: 0 }), 'housing'],
    ]);
    expect(result.power.balance).toBe(10); // +12 - 2
    expect(result.power.supply).toBe(12);
    expect(result.power.demand).toBe(2);
  });

  it('excludes isolated cells from provides/flows but still counts their emissions', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'generator' }], // ground floor, reachable
      [cellKey({ x: 0, y: 1, z: 0 }), { blockId: 'generator' }], // stacked without stairs -> isolated
    ]);
    const access = computeAccess(cells, blocks);
    expect(access.isolated.size).toBe(1);
    const synergy = computeSynergyEffects(cells, blocks);
    const result = computeEconomyStats({ cells, blocks, access, synergy, population: 0 });
    expect(result.power.balance).toBe(12); // 고립된 발전기는 생산에 포함되지 않는다
    expect(result.pollution).toBe(8); // 오염은 고립 여부와 무관하게 물리적으로 계속 배출
  });

  it('produces zero housing capacity with no residential blocks', () => {
    const result = stats([[cellKey({ x: 0, y: 0, z: 0 }), 'generator']]);
    expect(result.housingCapacityRaw).toBe(0);
    expect(result.housingCapacity).toBe(0);
  });
});

describe('stepPopulation', () => {
  it('moves toward capacity slowly when there is room to grow', () => {
    const next = stepPopulation(0, 100);
    expect(next).toBeCloseTo(4); // 100 * POP_INFLOW_RATE(0.04)
  });

  it('drops toward a shrinking capacity quickly', () => {
    const next = stepPopulation(100, 0);
    expect(next).toBeCloseTo(65); // 100 - 100 * POP_OUTFLOW_RATE(0.35)
  });

  it('never goes negative', () => {
    expect(stepPopulation(1, -50)).toBeGreaterThanOrEqual(0);
  });
});
