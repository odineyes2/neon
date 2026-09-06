import { describe, expect, it } from 'vitest';
import {
  SAVE_VERSION,
  deserialize,
  saveStateToCellsMap,
  saveStateToCharacterRoster,
  serialize,
  type SerializableGameState,
} from '../src/sim/save';

function fullState(overrides: Partial<SerializableGameState> = {}): SerializableGameState {
  return {
    tick: 42,
    credits: 1234,
    population: 7,
    bounds: { x: 3, z: 3 },
    cells: new Map([
      ['0,0,0', { blockId: 'container_housing' }],
      ['1,0,0', { blockId: 'street_stall' }],
    ]),
    eventFlags: new Set(['chose_lightwell']),
    firedEventIds: new Set(['first_customer', 'dark_floors']),
    modifiers: { appeal: 5, order: -2 },
    characterRoster: new Map([['lao_chen', { assignedCellKey: '0,0,0', joinedTick: 10, questStage: 1 }]]),
    departedCharacterIds: new Set(['kage']),
    ...overrides,
  };
}

describe('save/load round-trip', () => {
  it('serializes and deserializes the full game state losslessly', () => {
    const json = serialize(fullState());
    const loaded = deserialize(json);

    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.tick).toBe(42);
    expect(loaded.credits).toBe(1234);
    expect(loaded.population).toBe(7);
    expect(loaded.bounds).toEqual({ x: 3, z: 3 });
    expect(loaded.eventFlags).toEqual(['chose_lightwell']);
    expect(loaded.firedEventIds).toEqual(['first_customer', 'dark_floors']);
    expect(loaded.modifiers).toEqual({ appeal: 5, order: -2 });
    expect(loaded.departedCharacterIds).toEqual(['kage']);

    const restoredCells = saveStateToCellsMap(loaded);
    expect(restoredCells.get('0,0,0')).toEqual({ blockId: 'container_housing' });
    expect(restoredCells.size).toBe(2);

    const restoredRoster = saveStateToCharacterRoster(loaded);
    expect(restoredRoster.get('lao_chen')).toEqual({ assignedCellKey: '0,0,0', joinedTick: 10, questStage: 1 });
  });

  it('rejects a payload with no version field', () => {
    expect(() => deserialize(JSON.stringify({ tick: 0 }))).toThrow();
  });

  it('migrates a v1 save (pre-events/characters) by filling in empty defaults', () => {
    const v1Json = JSON.stringify({
      version: 1,
      tick: 10,
      credits: 500,
      population: 3,
      bounds: { x: 3, z: 3 },
      cells: [{ key: '0,0,0', blockId: 'container_housing' }],
    });

    const loaded = deserialize(v1Json);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.tick).toBe(10);
    expect(loaded.eventFlags).toEqual([]);
    expect(loaded.firedEventIds).toEqual([]);
    expect(loaded.modifiers).toEqual({ appeal: 0, order: 0 });
    expect(loaded.characterRoster).toEqual([]);
    expect(loaded.departedCharacterIds).toEqual([]);
    expect(saveStateToCellsMap(loaded).get('0,0,0')).toEqual({ blockId: 'container_housing' });
  });
});
