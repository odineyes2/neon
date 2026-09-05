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
