// 채광 판정: 외기 접촉면 계산. three.js 비의존.
//
// 측면 4면 + 옥상 1면만 센다(바닥면은 애초에 채광과 무관하다는 게 스펙의 전제).

import { type CellCoord, type CellIndex, cellKey } from './grid';
import type { LightPref } from './blocks';

const LIGHT_FACE_OFFSETS: readonly CellCoord[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 1, z: 0 },
];

export function exposedFaceCount(cells: CellIndex, coord: CellCoord): number {
  let count = 0;
  for (const offset of LIGHT_FACE_OFFSETS) {
    const neighborKey = cellKey({ x: coord.x + offset.x, y: coord.y + offset.y, z: coord.z + offset.z });
    if (!cells.has(neighborKey)) count++;
  }
  return count;
}

export function isDarkCell(cells: CellIndex, coord: CellCoord): boolean {
  return exposedFaceCount(cells, coord) === 0;
}

// lightPref에 따른 매력 보정. 균형 조정 전 임시 상수.
export function lightAppealDelta(isDark: boolean, lightPref: LightPref): number {
  if (lightPref === 'NEEDS_LIGHT') return isDark ? -8 : 0;
  if (lightPref === 'PREFERS_DARK') return isDark ? 4 : 0;
  return 0;
}
