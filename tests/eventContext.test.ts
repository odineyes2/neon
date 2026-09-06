import { describe, expect, it } from 'vitest';
import { cellKey } from '../src/sim/grid';
import { buildEventContext } from '../src/sim/eventContext';
import { computeAccess } from '../src/sim/access';
import { computeSynergyEffects } from '../src/sim/adjacency';
import { computeEconomyStats } from '../src/sim/economy';
import { BLOCK_REGISTRY } from '../src/sim/blocks';

function stats(cellsInput: Array<[string, string]>, population = 0) {
  const cells = new Map(cellsInput.map(([key, blockId]) => [key, { blockId }]));
  const access = computeAccess(cells, BLOCK_REGISTRY);
  const synergy = computeSynergyEffects(cells, BLOCK_REGISTRY);
  return { cells, stats: computeEconomyStats({ cells, blocks: BLOCK_REGISTRY, access, synergy, population }) };
}

describe('buildEventContext', () => {
  it('flags block presence and computes overload/day/floors', () => {
    const { cells, stats: economyStats } = stats([
      [cellKey({ x: 0, y: 0, z: 0 }), 'street_stall'], // structuralCapacity 0
      [cellKey({ x: 0, y: 1, z: 0 }), 'container_housing'], // 위에 얹혀서 stall을 과부하시킨다
      [cellKey({ x: 1, y: 0, z: 0 }), 'nightclub'],
    ]);

    const ctx = buildEventContext({
      cells,
      blocks: BLOCK_REGISTRY,
      stats: economyStats,
      population: 42,
      credits: 777,
      tickCount: 50,
    });

    expect(ctx.population).toBe(42);
    expect(ctx.credits).toBe(777);
    expect(ctx.day).toBe(Math.floor(50 / 24) + 1);
    expect(ctx.builtFloors).toBe(2);
    expect(ctx.overloaded).toBe(1); // stall 밑에 깔린 하중
    expect(ctx.hasNightclub).toBe(1);
    expect(ctx.hasShrine).toBe(0);
  });
});
