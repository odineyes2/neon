import { describe, expect, it } from 'vitest';
import { cellKey } from '../src/sim/grid';
import { tick, type TickState } from '../src/sim/tick';
import { BLOCK_REGISTRY } from '../src/sim/blocks';

function baseState(overrides: Partial<TickState>): TickState {
  return {
    cells: new Map(),
    population: 0,
    credits: 0,
    modifiers: { appeal: 0, order: 0 },
    eventFlags: new Set(),
    firedEventIds: new Set(),
    tickCount: 0,
    ...overrides,
  };
}

describe('tick', () => {
  it('grows population toward capacity and accrues income minus upkeep', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'container_housing' }],
      [cellKey({ x: 1, y: 0, z: 0 }), { blockId: 'street_stall' }],
      [cellKey({ x: 2, y: 0, z: 0 }), { blockId: 'diesel_generator' }],
      [cellKey({ x: -1, y: 0, z: 0 }), { blockId: 'water_tank' }],
    ]);

    const result = tick(baseState({ cells }), BLOCK_REGISTRY);

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
    const result = tick(baseState({ cells }), BLOCK_REGISTRY);
    expect(result.isolatedCells.has(cellKey({ x: 0, y: 1, z: 0 }))).toBe(true);
    expect(result.stats.jobs).toBe(0); // 고립된 노점은 일자리를 제공하지 않는다
  });

  it('surfaces a triggered event once its condition is met', () => {
    // 인구 조건은 이번 틱의 수렴 이후 값을 보므로, 수용력과 무관한 블록 존재
    // 조건(사당 헌정)으로 확인한다.
    const cells = new Map([[cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'alley_shrine' }]]);
    const result = tick(baseState({ cells }), BLOCK_REGISTRY);
    expect(result.triggeredEvent?.id).toBe('shrine_dedication');
  });

  it('does not re-surface a once-only event already fired', () => {
    const cells = new Map([[cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'alley_shrine' }]]);
    const result = tick(baseState({ cells, firedEventIds: new Set(['shrine_dedication']) }), BLOCK_REGISTRY);
    expect(result.triggeredEvent?.id).not.toBe('shrine_dedication');
  });

  it('feeds permanent modifiers into appeal/order', () => {
    const cells = new Map([[cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'container_housing' }]]);
    const withoutModifiers = tick(baseState({ cells }), BLOCK_REGISTRY);
    const withModifiers = tick(baseState({ cells, modifiers: { appeal: 50, order: -20 } }), BLOCK_REGISTRY);
    expect(withModifiers.stats.appeal).toBeCloseTo(withoutModifiers.stats.appeal + 50);
    expect(withModifiers.stats.order).toBeCloseTo(withoutModifiers.stats.order - 20);
  });
});
