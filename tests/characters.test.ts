import { describe, expect, it } from 'vitest';
import { cellKey } from '../src/sim/grid';
import { advanceQuests, processDepartures, tryRecruit, type CharacterDef } from '../src/sim/characters';
import type { BlockDef } from '../src/sim/blocks';

function makeCharacter(id: string, recruitPopulation: number, stages = 3): CharacterDef {
  return {
    id,
    name: id,
    role: 'test',
    recruitPopulation,
    passive: '',
    quest: Array.from({ length: stages }, (_, i) => ({ title: `stage${i}`, body: '' })),
  };
}

const blocks: Record<string, BlockDef> = {
  room: { category: 'residential' } as BlockDef,
  stall: { category: 'commerce' } as BlockDef,
};

describe('tryRecruit', () => {
  it('recruits a character once population meets the threshold and housing is free', () => {
    const characters = [makeCharacter('a', 10)];
    const cells = new Map([[cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'room' }]]);
    const roster = tryRecruit(characters, new Map(), 10, cells, blocks, 100);
    expect(roster.has('a')).toBe(true);
    expect(roster.get('a')?.assignedCellKey).toBe(cellKey({ x: 0, y: 0, z: 0 }));
    expect(roster.get('a')?.questStage).toBe(0);
  });

  it('does not recruit below the population threshold', () => {
    const characters = [makeCharacter('a', 10)];
    const cells = new Map([[cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'room' }]]);
    const roster = tryRecruit(characters, new Map(), 9, cells, blocks, 100);
    expect(roster.has('a')).toBe(false);
  });

  it('does not recruit without an available residential cell', () => {
    const characters = [makeCharacter('a', 10)];
    const cells = new Map([[cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'stall' }]]);
    const roster = tryRecruit(characters, new Map(), 10, cells, blocks, 100);
    expect(roster.has('a')).toBe(false);
  });

  it('does not double-assign the same residential cell to two characters', () => {
    const characters = [makeCharacter('a', 10), makeCharacter('b', 10)];
    const cells = new Map([[cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'room' }]]);
    const roster = tryRecruit(characters, new Map(), 10, cells, blocks, 100);
    expect(roster.has('a')).toBe(true);
    expect(roster.has('b')).toBe(false);
  });

  it('never re-recruits a character who has already departed', () => {
    const characters = [makeCharacter('a', 10)];
    const cells = new Map([[cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'room' }]]);
    const roster = tryRecruit(characters, new Map(), 10, cells, blocks, 100, new Set(['a']));
    expect(roster.has('a')).toBe(false);
  });

  it('is idempotent for an already-recruited character', () => {
    const characters = [makeCharacter('a', 10)];
    const cells = new Map([[cellKey({ x: 0, y: 0, z: 0 }), { blockId: 'room' }]]);
    const first = tryRecruit(characters, new Map(), 10, cells, blocks, 100);
    const second = tryRecruit(characters, first, 10, cells, blocks, 200);
    expect(second.get('a')?.joinedTick).toBe(100); // 재합류로 덮어쓰지 않는다
  });
});

describe('processDepartures', () => {
  it('keeps a character whose home is intact and reachable', () => {
    const home = cellKey({ x: 0, y: 0, z: 0 });
    const roster = new Map([['a', { assignedCellKey: home, joinedTick: 0, questStage: 0 }]]);
    const cells = new Map([[home, { blockId: 'room' }]]);
    const result = processDepartures(roster, cells, new Set());
    expect(result.roster.has('a')).toBe(true);
    expect(result.departedIds).toEqual([]);
  });

  it('character leaves when their home is demolished', () => {
    const home = cellKey({ x: 0, y: 0, z: 0 });
    const roster = new Map([['a', { assignedCellKey: home, joinedTick: 0, questStage: 0 }]]);
    const result = processDepartures(roster, new Map(), new Set());
    expect(result.roster.has('a')).toBe(false);
    expect(result.departedIds).toEqual(['a']);
  });

  it('character leaves when their home becomes isolated', () => {
    const home = cellKey({ x: 0, y: 0, z: 0 });
    const roster = new Map([['a', { assignedCellKey: home, joinedTick: 0, questStage: 0 }]]);
    const cells = new Map([[home, { blockId: 'room' }]]);
    const result = processDepartures(roster, cells, new Set([home]));
    expect(result.roster.has('a')).toBe(false);
    expect(result.departedIds).toEqual(['a']);
  });
});

describe('advanceQuests', () => {
  const characters = [makeCharacter('a', 0, 3)];

  it('stays at stage 0 before the first interval elapses', () => {
    const roster = new Map([['a', { assignedCellKey: 'x', joinedTick: 0, questStage: 0 }]]);
    const next = advanceQuests(characters, roster, 24 * 5); // 5일
    expect(next.get('a')?.questStage).toBe(0);
  });

  it('advances one stage after the interval', () => {
    const roster = new Map([['a', { assignedCellKey: 'x', joinedTick: 0, questStage: 0 }]]);
    const next = advanceQuests(characters, roster, 24 * 10); // 10일
    expect(next.get('a')?.questStage).toBe(1);
  });

  it('never advances past the last stage', () => {
    const roster = new Map([['a', { assignedCellKey: 'x', joinedTick: 0, questStage: 0 }]]);
    const next = advanceQuests(characters, roster, 24 * 1000);
    expect(next.get('a')?.questStage).toBe(2); // quest.length - 1
  });
});
