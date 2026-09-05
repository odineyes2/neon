// 지지·철거 판정. three.js 비의존.

import { type CellCoord, type CellIndex, type PlotBounds, cellKey, isWithinBounds, lateralNeighbors, parseCellKey } from './grid';

export function hasDirectSupport(cells: CellIndex, coord: CellCoord): boolean {
  return coord.y === 0 || cells.has(cellKey({ x: coord.x, y: coord.y - 1, z: coord.z }));
}

// 셀은 바로 아래 셀이 있거나, 그 자체로 지지된(캔틸레버가 아닌) 인접 셀에 기대어
// 1칸까지 캔틸레버로 버틸 수 있다. 2칸 이상의 연쇄 돌출은 허용하지 않는다.
export function isSupported(cells: CellIndex, coord: CellCoord): boolean {
  if (hasDirectSupport(cells, coord)) return true;
  return lateralNeighbors(coord).some(
    (neighbor) => cells.has(cellKey(neighbor)) && hasDirectSupport(cells, neighbor)
  );
}

export interface RuleCheck {
  allowed: boolean;
  reason?: string;
}

export function canPlace(cells: CellIndex, coord: CellCoord, bounds: PlotBounds): RuleCheck {
  if (!isWithinBounds(coord, bounds)) {
    return { allowed: false, reason: '부지 경계를 벗어났다' };
  }
  if (cells.has(cellKey(coord))) {
    return { allowed: false, reason: '이미 점유된 셀이다' };
  }
  if (!isSupported(cells, coord)) {
    return { allowed: false, reason: '지지되지 않는다 (아래층 없음, 캔틸레버 한계 초과)' };
  }
  return { allowed: true };
}

export function canDemolish(cells: CellIndex, coord: CellCoord): RuleCheck {
  const above = cellKey({ x: coord.x, y: coord.y + 1, z: coord.z });
  if (cells.has(above)) {
    return { allowed: false, reason: '위층이 얹혀 있어 철거할 수 없다' };
  }
  return { allowed: true };
}

export interface WeightedBlock {
  weight: number;
  structuralCapacity: number;
}

export interface CellRecord {
  blockId: string;
}

// 같은 (x,z) 기둥에서 이 셀 위에 얹혀 이 셀이 떠받치는 하중의 합 [§3.2].
// v1 단순화: 실제 지지 그래프가 아니라 같은 열의 위쪽 전부를 합산한다.
export function loadAbove(
  cells: ReadonlyMap<string, CellRecord>,
  blocks: Readonly<Record<string, WeightedBlock>>,
  coord: CellCoord
): number {
  let total = 0;
  for (const [key, record] of cells) {
    const other = parseCellKey(key);
    if (other.x !== coord.x || other.z !== coord.z || other.y <= coord.y) continue;
    total += blocks[record.blockId]?.weight ?? 0;
  }
  return total;
}

// 용량이 0인 블록(예: 좌판)은 애초에 위에 아무것도 얹을 수 없다는 뜻으로 취급한다.
export function loadRatio(
  cells: ReadonlyMap<string, CellRecord>,
  blocks: Readonly<Record<string, WeightedBlock>>,
  coord: CellCoord
): number {
  const record = cells.get(cellKey(coord));
  if (!record) return 0;
  const capacity = blocks[record.blockId]?.structuralCapacity ?? 0;
  const load = loadAbove(cells, blocks, coord);
  if (load === 0) return 0;
  if (capacity <= 0) return Infinity;
  return load / capacity;
}

export function isOverloaded(
  cells: ReadonlyMap<string, CellRecord>,
  blocks: Readonly<Record<string, WeightedBlock>>,
  coord: CellCoord
): boolean {
  return loadRatio(cells, blocks, coord) > 1;
}
