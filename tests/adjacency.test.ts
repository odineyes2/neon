import { describe, expect, it } from 'vitest';
import { cellKey } from '../src/sim/grid';
import { computeSynergyEffects, getCellEffects, type SynergyRule } from '../src/sim/adjacency';
import type { BlockDef } from '../src/sim/blocks';

function makeBlock(id: string, category: BlockDef['category']): BlockDef {
  return {
    id,
    name: id,
    tier: 0,
    category,
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
  };
}

const blocks: Record<string, BlockDef> = {
  noodle_shop: makeBlock('noodle_shop', 'commerce'),
  street_stall: makeBlock('street_stall', 'commerce'),
  nightclub: makeBlock('nightclub', 'commerce'),
  housing: makeBlock('housing', 'residential'),
};

describe('computeSynergyEffects', () => {
  it('applies a mutual income bonus between a matched pair (골목 상권)', () => {
    const rules: SynergyRule[] = [
      {
        id: 'alley_market',
        sourceBlockId: 'noodle_shop',
        target: { blockId: 'street_stall' },
        range: 1,
        effect: { type: 'income_multiplier', delta: 0.15 },
        reciprocal: true,
      },
    ];
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'noodle_shop' }],
      [cellKey({ x: 1, y: 0, z: 0 }), { blockId: 'street_stall' }],
    ]);
    const effects = computeSynergyEffects(cells, blocks, rules);
    expect(getCellEffects(effects, cellKey({ x: 0, y: 0, z: 0 })).incomeMultiplier).toBeCloseTo(1.15);
    expect(getCellEffects(effects, cellKey({ x: 1, y: 0, z: 0 })).incomeMultiplier).toBeCloseTo(1.15);
  });

  it('applies a one-directional category penalty (나이트클럽 → 인접 주거)', () => {
    const rules: SynergyRule[] = [
      {
        id: 'nightclub_noise',
        sourceBlockId: 'nightclub',
        target: { category: 'residential' },
        range: 1,
        effect: { type: 'appeal_delta', delta: -12 },
      },
    ];
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'nightclub' }],
      [cellKey({ x: 1, y: 0, z: 0 }), { blockId: 'housing' }],
    ]);
    const effects = computeSynergyEffects(cells, blocks, rules);
    expect(getCellEffects(effects, cellKey({ x: 1, y: 0, z: 0 })).appealDelta).toBe(-12);
    // 나이트클럽 본인은 페널티를 받지 않는다 (단방향, reciprocal 없음).
    expect(getCellEffects(effects, cellKey({ x: 0, y: 0, z: 0 })).appealDelta).toBe(0);
  });

  it('does not affect cells outside the configured range', () => {
    const rules: SynergyRule[] = [
      {
        id: 'shrine_order',
        sourceBlockId: 'nightclub',
        target: { category: 'residential' },
        range: 1,
        effect: { type: 'order_delta', delta: 4 },
      },
    ];
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'nightclub' }],
      [cellKey({ x: 3, y: 0, z: 0 }), { blockId: 'housing' }],
    ]);
    const effects = computeSynergyEffects(cells, blocks, rules);
    expect(getCellEffects(effects, cellKey({ x: 3, y: 0, z: 0 })).orderDelta).toBe(0);
  });

  it('returns an empty map when no rules are configured', () => {
    const cells = new Map([[cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'housing' }]]);
    const effects = computeSynergyEffects(cells, blocks, []);
    expect(effects.size).toBe(0);
  });
});
