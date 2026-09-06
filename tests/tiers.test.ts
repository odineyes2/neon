import { describe, expect, it } from 'vitest';
import { cellKey } from '../src/sim/grid';
import { isTierUnlocked, maxBuiltFloor } from '../src/sim/tiers';

describe('maxBuiltFloor', () => {
  it('is 0 with nothing built', () => {
    expect(maxBuiltFloor(new Map())).toBe(0);
  });

  it('counts 1-indexed floors from the highest occupied y', () => {
    const cells = new Map([
      [cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'x' }],
      [cellKey({ x: 0, y: 3, z: 0 }), { blockId: 'x' }],
    ]);
    expect(maxBuiltFloor(cells)).toBe(4);
  });
});

describe('isTierUnlocked', () => {
  it('tier 0 is always unlocked', () => {
    expect(isTierUnlocked(0, 0, 0)).toBe(true);
  });

  it('locks tier 1 below its population threshold', () => {
    expect(isTierUnlocked(1, 11, 0)).toBe(false);
    expect(isTierUnlocked(1, 12, 0)).toBe(true);
  });

  it('locks tier 5 on population alone without enough floors', () => {
    expect(isTierUnlocked(5, 200, 5)).toBe(false);
    expect(isTierUnlocked(5, 200, 13)).toBe(true);
  });

  it('rejects an undefined tier', () => {
    expect(isTierUnlocked(6, 1_000_000, 100)).toBe(false);
  });
});
