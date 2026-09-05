// 접근성 판정: 1층 출입구로부터의 BFS. three.js 비의존.
//
// 규칙: 모든 y=0 셀은 그 자체로 출입구에 닿아 있다(다중 출발점 BFS).
// 같은 층의 인접 셀은 항상 지나갈 수 있다(방을 가로질러 걷는다고 가정).
// 위/아래 층 이동은 두 셀 중 하나라도 access 카테고리(계단 등)이면 가능하다 —
// 계단이 아래층에 있든 위층에 있든 그 사이는 이어진다.

import { type CellCoord, cellKey, lateralNeighbors, parseCellKey } from './grid';
import type { BlockDef } from './blocks';

export interface CellRecord {
  blockId: string;
}

export interface AccessResult {
  walkCost: ReadonlyMap<string, number>;
  isolated: ReadonlySet<string>;
}

export function computeAccess(
  cells: ReadonlyMap<string, CellRecord>,
  blocks: Readonly<Record<string, BlockDef>>
): AccessResult {
  const walkCost = new Map<string, number>();
  const queue: string[] = [];

  for (const key of cells.keys()) {
    if (parseCellKey(key).y === 0) {
      walkCost.set(key, 0);
      queue.push(key);
    }
  }

  function isAccess(key: string): boolean {
    const record = cells.get(key);
    return record !== undefined && blocks[record.blockId]?.category === 'access';
  }

  let head = 0;
  while (head < queue.length) {
    const key = queue[head++];
    const coord = parseCellKey(key);
    const dist = walkCost.get(key)!;

    const candidates: CellCoord[] = [...lateralNeighbors(coord)];
    const up = { x: coord.x, y: coord.y + 1, z: coord.z };
    const down = { x: coord.x, y: coord.y - 1, z: coord.z };
    if (isAccess(key) || isAccess(cellKey(up))) candidates.push(up);
    if (isAccess(key) || isAccess(cellKey(down))) candidates.push(down);

    for (const candidate of candidates) {
      const candidateKey = cellKey(candidate);
      if (!cells.has(candidateKey) || walkCost.has(candidateKey)) continue;
      walkCost.set(candidateKey, dist + 1);
      queue.push(candidateKey);
    }
  }

  const isolated = new Set<string>();
  for (const key of cells.keys()) {
    if (!walkCost.has(key)) isolated.add(key);
  }

  return { walkCost, isolated };
}

export function averageWalkCost(access: AccessResult): number {
  if (access.walkCost.size === 0) return 0;
  let total = 0;
  for (const cost of access.walkCost.values()) total += cost;
  return total / access.walkCost.size;
}
