// 직렬화 + 버전 마이그레이션. three.js 비의존.

export const SAVE_VERSION = 1;

export interface CellRecord {
  blockId: string;
}

export interface SaveState {
  version: number;
  tick: number;
  credits: number;
  population: number;
  bounds: { x: number; z: number };
  cells: Array<{ key: string; blockId: string }>;
}

export interface SerializableGameState {
  tick: number;
  credits: number;
  population: number;
  bounds: { x: number; z: number };
  cells: ReadonlyMap<string, CellRecord>;
}

export function serialize(state: SerializableGameState): string {
  const payload: SaveState = {
    version: SAVE_VERSION,
    tick: state.tick,
    credits: state.credits,
    population: state.population,
    bounds: state.bounds,
    cells: Array.from(state.cells, ([key, record]) => ({ key, blockId: record.blockId })),
  };
  return JSON.stringify(payload);
}

// 버전별 마이그레이션 체인. 지금은 v1 하나뿐이라 통과만 시킨다.
// 다음 버전이 생기면 { from: 1, migrate: (raw) => ({...}) } 형태로 여기 추가한다.
const MIGRATIONS: Array<{ from: number; migrate: (raw: SaveState) => SaveState }> = [];

function migrate(raw: SaveState): SaveState {
  let current = raw;
  while (current.version < SAVE_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === current.version);
    if (!step) {
      throw new Error(`v${current.version}에서 v${SAVE_VERSION}으로 가는 마이그레이션이 없다`);
    }
    current = step.migrate(current);
  }
  return current;
}

export function deserialize(json: string): SaveState {
  const raw = JSON.parse(json) as SaveState;
  if (typeof raw.version !== 'number') {
    throw new Error('세이브 데이터에 버전 정보가 없다');
  }
  return migrate(raw);
}

export function saveStateToCellsMap(save: SaveState): Map<string, CellRecord> {
  return new Map(save.cells.map(({ key, blockId }) => [key, { blockId }]));
}
