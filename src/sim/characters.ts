// 캐릭터 로스터: 합류·거주 배정·이탈·퀘스트 진행 [§6.2]. three.js 비의존.

import charactersData from '../data/characters.json';
import { type CellCoord, cellKey, parseCellKey } from './grid';
import type { BlockDef } from './blocks';

export interface CharacterQuestStage {
  title: string;
  body: string;
}

export interface CharacterDef {
  id: string;
  name: string;
  role: string;
  recruitPopulation: number;
  passive: string;
  quest: CharacterQuestStage[];
}

export const CHARACTERS: readonly CharacterDef[] = charactersData as CharacterDef[];
export const CHARACTER_REGISTRY: Readonly<Record<string, CharacterDef>> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c])
);

export interface CharacterState {
  assignedCellKey: string;
  joinedTick: number;
  questStage: number; // 0부터 시작, quest.length-1이 마지막 단계
}

export type CharacterRoster = ReadonlyMap<string, CharacterState>;

export interface CellRecord {
  blockId: string;
}

const DAYS_PER_QUEST_STAGE = 10;
const TICKS_PER_DAY = 24;

function findAvailableResidentialCell(
  cells: ReadonlyMap<string, CellRecord>,
  blocks: Readonly<Record<string, BlockDef>>,
  roster: CharacterRoster
): CellCoord | null {
  const occupied = new Set(Array.from(roster.values(), (s) => s.assignedCellKey));
  for (const [key, record] of cells) {
    if (occupied.has(key)) continue;
    if (blocks[record.blockId]?.category === 'residential') return parseCellKey(key);
  }
  return null;
}

// 인구 조건을 채운 미합류 캐릭터를, 빈 주거 셀이 있으면 합류시킨다.
export function tryRecruit(
  characters: readonly CharacterDef[],
  roster: CharacterRoster,
  population: number,
  cells: ReadonlyMap<string, CellRecord>,
  blocks: Readonly<Record<string, BlockDef>>,
  tickCount: number,
  departed: ReadonlySet<string> = new Set()
): CharacterRoster {
  let next: CharacterRoster = roster;
  for (const character of characters) {
    if (next.has(character.id)) continue;
    if (departed.has(character.id)) continue; // 한 번 떠난 사람은 돌아오지 않는다 [§6.2]
    if (population < character.recruitPopulation) continue;
    const cell = findAvailableResidentialCell(cells, blocks, next);
    if (!cell) continue;
    const updated = new Map(next);
    updated.set(character.id, { assignedCellKey: cellKey(cell), joinedTick: tickCount, questStage: 0 });
    next = updated;
  }
  return next;
}

export interface DepartureResult {
  roster: CharacterRoster;
  departedIds: readonly string[];
}

// 거주 셀이 철거되거나 고립되면 캐릭터는 떠난다 [§6.2].
export function processDepartures(
  roster: CharacterRoster,
  cells: ReadonlyMap<string, CellRecord>,
  isolated: ReadonlySet<string>
): DepartureResult {
  const departedIds: string[] = [];
  const next = new Map(roster);
  for (const [id, state] of roster) {
    const stillHome = cells.has(state.assignedCellKey) && !isolated.has(state.assignedCellKey);
    if (!stillHome) {
      next.delete(id);
      departedIds.push(id);
    }
  }
  return { roster: next, departedIds };
}

// 합류 후 일정 기간마다 퀘스트 단계를 한 칸씩 진행한다 (마지막 단계에서 멈춤).
export function advanceQuests(characters: readonly CharacterDef[], roster: CharacterRoster, tickCount: number): CharacterRoster {
  const registry = Object.fromEntries(characters.map((c) => [c.id, c]));
  const next = new Map(roster);
  let changed = false;
  for (const [id, state] of roster) {
    const character = registry[id];
    if (!character) continue;
    const daysSinceJoin = (tickCount - state.joinedTick) / TICKS_PER_DAY;
    const targetStage = Math.min(character.quest.length - 1, Math.floor(daysSinceJoin / DAYS_PER_QUEST_STAGE));
    if (targetStage > state.questStage) {
      next.set(id, { ...state, questStage: targetStage });
      changed = true;
    }
  }
  return changed ? next : roster;
}
