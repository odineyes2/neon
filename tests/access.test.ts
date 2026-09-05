import { describe, expect, it } from 'vitest';
import { cellKey } from '../src/sim/grid';
import { computeAccess } from '../src/sim/access';
import type { BlockDef } from '../src/sim/blocks';

function makeBlocks(overrides: Partial<Record<string, BlockDef['category']>>): Record<string, BlockDef> {
  const base = (id: string, category: BlockDef['category']): BlockDef => ({
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
  });
  const registry: Record<string, BlockDef> = {};
  for (const [id, category] of Object.entries(overrides)) {
    registry[id] = base(id, category!);
  }
  return registry;
}

describe('computeAccess', () => {
  const blocks = makeBlocks({ room: 'residential', stairs: 'access' });

  it('treats every ground-floor cell as reachable at cost 0', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'room' }],
      [cellKey({ x: 1, y: 0, z: 0 }), { blockId: 'room' }],
    ]);
    const access = computeAccess(cells, blocks);
    expect(access.isolated.size).toBe(0);
    expect(access.walkCost.get(cellKey({ x: 0, y: 0, z: 0 }))).toBe(0);
    expect(access.walkCost.get(cellKey({ x: 1, y: 0, z: 0 }))).toBe(0);
  });

  it('reaches a stacked room only through a stairs cell', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'stairs' }],
      [cellKey({ x: 0, y: 1, z: 0 }), { blockId: 'room' }],
    ]);
    const access = computeAccess(cells, blocks);
    expect(access.isolated.size).toBe(0);
    expect(access.walkCost.get(cellKey({ x: 0, y: 1, z: 0 }))).toBe(1);
  });

  it('reaches stairs stacked on top of an ordinary room (either order works)', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'room' }],
      [cellKey({ x: 0, y: 1, z: 0 }), { blockId: 'stairs' }],
    ]);
    const access = computeAccess(cells, blocks);
    expect(access.isolated.size).toBe(0);
    expect(access.walkCost.get(cellKey({ x: 0, y: 1, z: 0 }))).toBe(1);
  });

  it('marks a room stacked without stairs as isolated', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'room' }],
      [cellKey({ x: 0, y: 1, z: 0 }), { blockId: 'room' }],
    ]);
    const access = computeAccess(cells, blocks);
    expect(access.isolated.has(cellKey({ x: 0, y: 1, z: 0 }))).toBe(true);
  });

  it('walks laterally on an upper floor once reached through stairs', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'stairs' }],
      [cellKey({ x: 0, y: 1, z: 0 }), { blockId: 'room' }],
      [cellKey({ x: 1, y: 1, z: 0 }), { blockId: 'room' }],
    ]);
    const access = computeAccess(cells, blocks);
    expect(access.walkCost.get(cellKey({ x: 0, y: 1, z: 0 }))).toBe(1);
    expect(access.walkCost.get(cellKey({ x: 1, y: 1, z: 0 }))).toBe(2);
  });
});
