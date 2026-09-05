import { describe, expect, it } from 'vitest';
import { cellKey } from '../src/sim/grid';
import { computeSpatialField } from '../src/sim/fields';
import type { BlockDef } from '../src/sim/blocks';

function makeBlock(id: string, noise: number): BlockDef {
  return {
    id,
    name: id,
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
    emits: { noise },
    visual: { base: '', facade: '', props: [] },
    description: '',
  };
}

const blocks: Record<string, BlockDef> = {
  loud: makeBlock('loud', 9),
  quiet: makeBlock('quiet', 0),
};

describe('computeSpatialField', () => {
  it('gives the source cell its own full strength', () => {
    const cells = new Map([[cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'loud' }]]);
    const field = computeSpatialField(cells, blocks, (b) => b.emits.noise ?? 0, 3);
    expect(field.get(cellKey({ x: 0, y: 0, z: 0 }))).toBe(9);
  });

  it('decays with distance up to the radius, then stops', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'loud' }],
      [cellKey({ x: 3, y: 0, z: 0 }), { blockId: 'quiet' }],
      [cellKey({ x: 4, y: 0, z: 0 }), { blockId: 'quiet' }],
    ]);
    const field = computeSpatialField(cells, blocks, (b) => b.emits.noise ?? 0, 3);
    const near = field.get(cellKey({ x: 3, y: 0, z: 0 }))!;
    const far = field.get(cellKey({ x: 4, y: 0, z: 0 }))!;
    expect(near).toBeGreaterThan(0);
    expect(far).toBe(0); // 거리 4 > radius 3
  });

  it('ignores sources on a different floor', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'loud' }],
      [cellKey({ x: 0, y: 1, z: 0 }), { blockId: 'quiet' }],
    ]);
    const field = computeSpatialField(cells, blocks, (b) => b.emits.noise ?? 0, 3);
    expect(field.get(cellKey({ x: 0, y: 1, z: 0 }))).toBe(0);
  });
});
