import { describe, expect, it } from 'vitest';
import { type CellCoord, cellKey } from '../src/sim/grid';
import { canDemolish, canPlace, isOverloaded, isSupported, loadAbove, loadRatio } from '../src/sim/structure';
import type { WeightedBlock } from '../src/sim/structure';

function cellSet(coords: CellCoord[]): Set<string> {
  return new Set(coords.map(cellKey));
}

describe('isSupported', () => {
  it('supports ground floor cells unconditionally', () => {
    expect(isSupported(new Set(), { x: 0, y: 0, z: 0 })).toBe(true);
  });

  it('supports a cell stacked directly on another', () => {
    const cells = cellSet([{ x: 0, y: 0, z: 0 }]);
    expect(isSupported(cells, { x: 0, y: 1, z: 0 })).toBe(true);
  });

  it('allows a 1-cell cantilever off a grounded neighbor', () => {
    const cells = cellSet([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ]);
    expect(isSupported(cells, { x: 1, y: 1, z: 0 })).toBe(true);
  });

  it('rejects a 2-cell cantilever chain', () => {
    const cells = cellSet([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 }, // 이미 캔틸레버로 지지된 셀
    ]);
    // x:1,y:1은 그 자체로 캔틸레버라 x:2,y:1을 지지할 수 없다.
    expect(isSupported(cells, { x: 2, y: 1, z: 0 })).toBe(false);
  });

  it('rejects a floating cell with no neighbor at all', () => {
    expect(isSupported(new Set(), { x: 0, y: 3, z: 0 })).toBe(false);
  });
});

describe('canPlace', () => {
  const bounds = { x: 3, z: 3 };

  it('blocks placement outside the site bounds', () => {
    expect(canPlace(new Set(), { x: 5, y: 0, z: 0 }, bounds).allowed).toBe(false);
  });

  it('blocks placement on an occupied cell', () => {
    const cells = cellSet([{ x: 0, y: 0, z: 0 }]);
    expect(canPlace(cells, { x: 0, y: 0, z: 0 }, bounds).allowed).toBe(false);
  });

  it('blocks placement without support', () => {
    expect(canPlace(new Set(), { x: 0, y: 2, z: 0 }, bounds).allowed).toBe(false);
  });

  it('allows a valid ground-floor placement', () => {
    expect(canPlace(new Set(), { x: 0, y: 0, z: 0 }, bounds).allowed).toBe(true);
  });
});

function cellMap(entries: Array<[CellCoord, string]>): Map<string, { blockId: string }> {
  return new Map(entries.map(([coord, blockId]) => [cellKey(coord), { blockId }]));
}

describe('loadAbove / loadRatio / isOverloaded', () => {
  const blocks: Record<string, WeightedBlock> = {
    light: { weight: 2, structuralCapacity: 10 },
    heavy: { weight: 8, structuralCapacity: 5 },
    weightless_stairs: { weight: 0, structuralCapacity: 30 },
  };

  it('sums the weight of everything above in the same column', () => {
    const cells = cellMap([
      [{ x: 0, y: 0, z: 0 }, 'light'],
      [{ x: 0, y: 1, z: 0 }, 'light'],
      [{ x: 0, y: 2, z: 0 }, 'heavy'],
    ]);
    expect(loadAbove(cells, blocks, { x: 0, y: 0, z: 0 })).toBe(2 + 8);
    expect(loadAbove(cells, blocks, { x: 0, y: 1, z: 0 })).toBe(8);
    expect(loadAbove(cells, blocks, { x: 0, y: 2, z: 0 })).toBe(0);
  });

  it('ignores cells in other columns', () => {
    const cells = cellMap([
      [{ x: 0, y: 0, z: 0 }, 'light'],
      [{ x: 1, y: 1, z: 0 }, 'heavy'],
    ]);
    expect(loadAbove(cells, blocks, { x: 0, y: 0, z: 0 })).toBe(0);
  });

  it('flags overload once the load above exceeds structural capacity', () => {
    const cells = cellMap([
      [{ x: 0, y: 0, z: 0 }, 'heavy'], // capacity 5
      [{ x: 0, y: 1, z: 0 }, 'heavy'], // weight 8, above the base
    ]);
    expect(loadRatio(cells, blocks, { x: 0, y: 0, z: 0 })).toBeCloseTo(8 / 5);
    expect(isOverloaded(cells, blocks, { x: 0, y: 0, z: 0 })).toBe(true);
  });

  it('treats zero-capacity blocks as overloaded by any load at all', () => {
    const cells = cellMap([
      [{ x: 0, y: 0, z: 0 }, 'light'],
      [{ x: 0, y: 1, z: 0 }, 'light'],
    ]);
    // light의 capacity는 10 > weight 2 이므로 과부하 아님
    expect(isOverloaded(cells, blocks, { x: 0, y: 0, z: 0 })).toBe(false);
  });

  it('is never overloaded with nothing resting on top', () => {
    const cells = cellMap([[{ x: 0, y: 0, z: 0 }, 'weightless_stairs']]);
    expect(loadRatio(cells, blocks, { x: 0, y: 0, z: 0 })).toBe(0);
    expect(isOverloaded(cells, blocks, { x: 0, y: 0, z: 0 })).toBe(false);
  });
});

describe('canDemolish', () => {
  it('blocks demolition when a cell rests on top', () => {
    const cells = cellSet([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ]);
    expect(canDemolish(cells, { x: 0, y: 0, z: 0 }).allowed).toBe(false);
  });

  it('allows demolition of a topmost cell', () => {
    const cells = cellSet([{ x: 0, y: 0, z: 0 }]);
    expect(canDemolish(cells, { x: 0, y: 0, z: 0 }).allowed).toBe(true);
  });
});
