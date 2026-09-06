// 티어 해금 조건: 인구 임계값 (+ 5티어는 최소 층수) [§6.1]. three.js 비의존.

import { parseCellKey } from './grid';

export const TIER_UNLOCK_POPULATION: readonly number[] = [0, 12, 28, 55, 95, 170];
export const TIER5_MIN_FLOORS = 13;

export interface CellRecord {
  blockId: string;
}

// 1층부터 센 건설된 최고층 수. 아무것도 없으면 0.
export function maxBuiltFloor(cells: ReadonlyMap<string, CellRecord>): number {
  let maxY = -1;
  for (const key of cells.keys()) {
    const y = parseCellKey(key).y;
    if (y > maxY) maxY = y;
  }
  return maxY + 1;
}

export function isTierUnlocked(tier: number, population: number, builtFloors: number): boolean {
  const threshold = TIER_UNLOCK_POPULATION[tier];
  if (threshold === undefined) return false; // 정의되지 않은 티어는 아직 없다
  if (population < threshold) return false;
  if (tier >= 5 && builtFloors < TIER5_MIN_FLOORS) return false;
  return true;
}
