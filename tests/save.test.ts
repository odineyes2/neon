import { describe, expect, it } from 'vitest';
import { deserialize, saveStateToCellsMap, serialize } from '../src/sim/save';

describe('save/load round-trip', () => {
  it('serializes and deserializes cell data losslessly', () => {
    const cells = new Map([
      ['0,0,0', { blockId: 'container_housing' }],
      ['1,0,0', { blockId: 'street_stall' }],
    ]);
    const json = serialize({ tick: 42, credits: 1234, population: 7, bounds: { x: 3, z: 3 }, cells });

    const loaded = deserialize(json);
    expect(loaded.version).toBe(1);
    expect(loaded.tick).toBe(42);
    expect(loaded.credits).toBe(1234);
    expect(loaded.population).toBe(7);
    expect(loaded.bounds).toEqual({ x: 3, z: 3 });

    const restoredCells = saveStateToCellsMap(loaded);
    expect(restoredCells.get('0,0,0')).toEqual({ blockId: 'container_housing' });
    expect(restoredCells.get('1,0,0')).toEqual({ blockId: 'street_stall' });
    expect(restoredCells.size).toBe(2);
  });

  it('rejects a payload with no version field', () => {
    expect(() => deserialize(JSON.stringify({ tick: 0 }))).toThrow();
  });
});
