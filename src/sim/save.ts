// 직렬화 + 버전 마이그레이션. three.js 비의존.

export const SAVE_VERSION = 2;

export interface CellRecord {
  blockId: string;
}

export interface SaveStateV1 {
  version: 1;
  tick: number;
  credits: number;
  population: number;
  bounds: { x: number; z: number };
  cells: Array<{ key: string; blockId: string }>;
}

export interface CharacterStateEntry {
  id: string;
  assignedCellKey: string;
  joinedTick: number;
  questStage: number;
}

export interface SaveStateV2 {
  version: 2;
  tick: number;
  credits: number;
  population: number;
  bounds: { x: number; z: number };
  cells: Array<{ key: string; blockId: string }>;
  eventFlags: string[];
  firedEventIds: string[];
  modifiers: { appeal: number; order: number };
  characterRoster: CharacterStateEntry[];
  departedCharacterIds: string[];
}

export type SaveState = SaveStateV2;

export interface SerializableGameState {
  tick: number;
  credits: number;
  population: number;
  bounds: { x: number; z: number };
  cells: ReadonlyMap<string, CellRecord>;
  eventFlags: ReadonlySet<string>;
  firedEventIds: ReadonlySet<string>;
  modifiers: { appeal: number; order: number };
  characterRoster: ReadonlyMap<string, { assignedCellKey: string; joinedTick: number; questStage: number }>;
  departedCharacterIds: ReadonlySet<string>;
}

export function serialize(state: SerializableGameState): string {
  const payload: SaveStateV2 = {
    version: SAVE_VERSION,
    tick: state.tick,
    credits: state.credits,
    population: state.population,
    bounds: state.bounds,
    cells: Array.from(state.cells, ([key, record]) => ({ key, blockId: record.blockId })),
    eventFlags: Array.from(state.eventFlags),
    firedEventIds: Array.from(state.firedEventIds),
    modifiers: state.modifiers,
    characterRoster: Array.from(state.characterRoster, ([id, s]) => ({ id, ...s })),
    departedCharacterIds: Array.from(state.departedCharacterIds),
  };
  return JSON.stringify(payload);
}

// 버전별 마이그레이션 체인. v1 세이브(M2~M4 시절)에는 이벤트/캐릭터 필드가 아예
// 없었으므로, 빈 상태로 채워 넣는다. 다음 버전이 생기면 여기에 { from: 2, ... }를 더한다.
const MIGRATIONS: Array<{ from: number; migrate: (raw: SaveStateV1) => SaveStateV2 }> = [
  {
    from: 1,
    migrate: (raw) => ({
      ...raw,
      version: 2,
      eventFlags: [],
      firedEventIds: [],
      modifiers: { appeal: 0, order: 0 },
      characterRoster: [],
      departedCharacterIds: [],
    }),
  },
];

function migrate(raw: SaveStateV1 | SaveStateV2): SaveStateV2 {
  let current: SaveStateV1 | SaveStateV2 = raw;
  while (current.version < SAVE_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === current.version);
    if (!step) {
      throw new Error(`v${current.version}에서 v${SAVE_VERSION}으로 가는 마이그레이션이 없다`);
    }
    current = step.migrate(current as SaveStateV1);
  }
  return current as SaveStateV2;
}

export function deserialize(json: string): SaveStateV2 {
  const raw = JSON.parse(json) as SaveStateV1 | SaveStateV2;
  if (typeof raw.version !== 'number') {
    throw new Error('세이브 데이터에 버전 정보가 없다');
  }
  return migrate(raw);
}

export function saveStateToCellsMap(save: SaveStateV2): Map<string, CellRecord> {
  return new Map(save.cells.map(({ key, blockId }) => [key, { blockId }]));
}

export function saveStateToCharacterRoster(
  save: SaveStateV2
): Map<string, { assignedCellKey: string; joinedTick: number; questStage: number }> {
  return new Map(
    save.characterRoster.map(({ id, ...state }) => [id, state])
  );
}
