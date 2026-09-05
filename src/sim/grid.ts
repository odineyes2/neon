// 3D 정수 격자 좌표 유틸. three.js 비의존.

export const CELL_SIZE = { x: 1.0, y: 1.2, z: 1.0 } as const;

export const START_BOUNDS = { x: 3, z: 3 } as const;
export const MAX_BOUNDS = { x: 13, z: 13 } as const;
export const MAX_HEIGHT = 24;

export const EXPANSION_BASE_COST = 800;

export function expansionCost(ringIndex: number): number {
  return EXPANSION_BASE_COST * 2 ** ringIndex;
}

export interface CellCoord {
  x: number;
  y: number;
  z: number;
}

export function cellKey({ x, y, z }: CellCoord): string {
  return `${x},${y},${z}`;
}

export function parseCellKey(key: string): CellCoord {
  const [x, y, z] = key.split(',').map(Number);
  return { x, y, z };
}

export function cellToWorldPosition({ x, y, z }: CellCoord): { x: number; y: number; z: number } {
  return {
    x: x * CELL_SIZE.x,
    y: y * CELL_SIZE.y,
    z: z * CELL_SIZE.z,
  };
}

export interface PlotBounds {
  x: number;
  z: number;
}

// 부지는 항상 홀수 크기로 중앙(0,0)을 기준으로 사방 동일하게 확장된다.
export function isWithinBounds({ x, y, z }: CellCoord, bounds: PlotBounds): boolean {
  const halfX = (bounds.x - 1) / 2;
  const halfZ = (bounds.z - 1) / 2;
  return x >= -halfX && x <= halfX && z >= -halfZ && z <= halfZ && y >= 0 && y < MAX_HEIGHT;
}

const LATERAL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function lateralNeighbors({ x, y, z }: CellCoord): CellCoord[] {
  return LATERAL_OFFSETS.map(([dx, dz]) => ({ x: x + dx, y, z: z + dz }));
}

// Set<string>과 Map<string, CellRecord> 양쪽 다 만족하는 최소 인터페이스.
// 지지·채광 같은 순수 기하 판정은 셀에 무엇이 있는지(블록 종류)는 몰라도 되고,
// 그 자리가 점유돼 있는지만 알면 된다.
export interface CellIndex {
  has(key: string): boolean;
}
