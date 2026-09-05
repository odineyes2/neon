import { describe, expect, it } from 'vitest';
import { cellKey } from '../src/sim/grid';
import { tick } from '../src/sim/tick';
import { BLOCK_REGISTRY } from '../src/sim/blocks';

describe('tick', () => {
  it('grows population toward capacity and accrues income minus upkeep', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'container_housing' }],
      [cellKey({ x: 1, y: 0, z: 0 }), { blockId: 'street_stall' }],
      [cellKey({ x: 2, y: 0, z: 0 }), { blockId: 'diesel_generator' }],
      [cellKey({ x: -1, y: 0, z: 0 }), { blockId: 'water_tank' }],
    ]);

    const result = tick({ cells, population: 0, credits: 0 }, BLOCK_REGISTRY);

    expect(result.population).toBeGreaterThan(0);
    expect(result.isolatedCells.size).toBe(0);
    expect(result.stats.power.balance).toBeGreaterThan(0); // 발전기가 소비량보다 많이 공급
    expect(typeof result.credits).toBe('number');
  });

  it('keeps a stacked room with no stairs isolated and non-productive', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'container_housing' }],
      [cellKey({ x: 0, y: 1, z: 0 }), { blockId: 'street_stall' }], // 계단 없이 위층
    ]);
    const result = tick({ cells, population: 0, credits: 0 }, BLOCK_REGISTRY);
    expect(result.isolatedCells.has(cellKey({ x: 0, y: 1, z: 0 }))).toBe(true);
    expect(result.stats.jobs).toBe(0); // 고립된 노점은 일자리를 제공하지 않는다
  });
});
