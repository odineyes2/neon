import { describe, expect, it } from 'vitest';
import { type CellCoord, cellKey } from '../src/sim/grid';
import { canDemolish, canPlace, isSupported } from '../src/sim/structure';

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
