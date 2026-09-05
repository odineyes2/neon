import { describe, expect, it } from 'vitest';
import { cellKey, cellToWorldPosition, expansionCost, parseCellKey } from '../src/sim/grid';

describe('grid', () => {
  it('round-trips cell keys', () => {
    const coord = { x: 2, y: 5, z: -1 };
    expect(parseCellKey(cellKey(coord))).toEqual(coord);
  });

  it('converts cell coords to world position using cell size', () => {
    const pos = cellToWorldPosition({ x: 2, y: 3, z: 1 });
    expect(pos.x).toBeCloseTo(2);
    expect(pos.y).toBeCloseTo(3.6);
    expect(pos.z).toBeCloseTo(1);
  });

  it('doubles expansion cost per ring', () => {
    expect(expansionCost(0)).toBe(800);
    expect(expansionCost(1)).toBe(1600);
    expect(expansionCost(2)).toBe(3200);
  });
});
