// 공간 확산장: 소음·오염처럼 인접 셀로 감쇠 전파되는 값을 계산한다 [§4.2].
// three.js 비의존.

import { parseCellKey } from './grid';
import type { BlockDef } from './blocks';

export interface CellRecord {
  blockId: string;
}

// 같은 층 기준 체비셰프 거리로 radius칸까지 선형 감쇠 전파한다.
export function computeSpatialField(
  cells: ReadonlyMap<string, CellRecord>,
  blocks: Readonly<Record<string, BlockDef>>,
  getSourceStrength: (block: BlockDef) => number,
  radius: number
): ReadonlyMap<string, number> {
  const field = new Map<string, number>();
  const entries = Array.from(cells.entries());

  const sources = entries
    .map(([key, record]) => ({ key, coord: parseCellKey(key), strength: blocks[record.blockId] ? getSourceStrength(blocks[record.blockId]) : 0 }))
    .filter((s) => s.strength > 0);

  for (const [key] of entries) {
    const coord = parseCellKey(key);
    let total = 0;
    for (const source of sources) {
      if (source.coord.y !== coord.y) continue;
      const distance = Math.max(Math.abs(source.coord.x - coord.x), Math.abs(source.coord.z - coord.z));
      if (distance > radius) continue;
      total += source.strength * (1 - distance / (radius + 1));
    }
    field.set(key, total);
  }

  return field;
}
