// 채광 판정: 외기 접촉면 계산. three.js 비의존.
//
// 측면 4면 + 옥상 1면만 센다(바닥면은 애초에 채광과 무관하다는 게 스펙의 전제).

import { type CellCoord, type CellIndex, cellKey } from './grid';
import type { BlockDef, LightPref } from './blocks';

export interface CellRecord {
  blockId: string;
}

// 광정(lightwell) 칸은 점유돼 있어도 빛을 막지 않는다 [§3.3].
export function makeLightwellOpenCheck(
  cells: ReadonlyMap<string, CellRecord>,
  blocks: Readonly<Record<string, BlockDef>>
): (neighborKey: string) => boolean {
  return (neighborKey) => {
    const record = cells.get(neighborKey);
    return record !== undefined && blocks[record.blockId]?.category === 'lightwell';
  };
}

const LIGHT_FACE_OFFSETS: readonly CellCoord[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 1, z: 0 },
];

// isOpen: 광정(lightwell)처럼 칸을 점유하면서도 빛을 막지 않는 블록을 위한 예외 훅.
// 기본값은 "점유돼 있지 않으면 열려 있다"는 기존 규칙 그대로.
export function exposedFaceCount(
  cells: CellIndex,
  coord: CellCoord,
  isOpen?: (neighborKey: string) => boolean
): number {
  let count = 0;
  for (const offset of LIGHT_FACE_OFFSETS) {
    const neighborKey = cellKey({ x: coord.x + offset.x, y: coord.y + offset.y, z: coord.z + offset.z });
    if (!cells.has(neighborKey) || isOpen?.(neighborKey)) count++;
  }
  return count;
}

export function isDarkCell(cells: CellIndex, coord: CellCoord, isOpen?: (neighborKey: string) => boolean): boolean {
  return exposedFaceCount(cells, coord, isOpen) === 0;
}

// lightPref에 따른 매력 보정. 균형 조정 전 임시 상수.
export function lightAppealDelta(isDark: boolean, lightPref: LightPref): number {
  if (lightPref === 'NEEDS_LIGHT') return isDark ? -8 : 0;
  if (lightPref === 'PREFERS_DARK') return isDark ? 4 : 0;
  return 0;
}
