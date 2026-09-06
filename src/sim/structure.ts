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

// loadAbove를 셀마다 부르면 셀당 O(n) 전체 스캔이라 총 O(n^2)이 된다 —
// 4000셀에서 틱 하나가 10초 넘게 걸리는 원인이었다. 기둥(x,z)별로 묶어 위에서
// 아래로 한 번만 누적하면 전체 O(n log n)으로 끝난다. 대량 계산(이벤트 조건,
// 오버레이)에는 이 배치 버전을, 셀 하나만 필요할 땐 loadRatio를 쓴다.
export function computeLoadRatioMap(
  cells: ReadonlyMap<string, CellRecord>,
  blocks: Readonly<Record<string, WeightedBlock>>
): Map<string, number> {
  const columns = new Map<string, CellCoord[]>();
  for (const key of cells.keys()) {
    const coord = parseCellKey(key);
    const columnKey = `${coord.x},${coord.z}`;
    const list = columns.get(columnKey);
    if (list) list.push(coord);
    else columns.set(columnKey, [coord]);
  }

  const result = new Map<string, number>();
  for (const coords of columns.values()) {
    coords.sort((a, b) => b.y - a.y); // 위층부터
    let loadAboveThis = 0;
    for (const coord of coords) {
      const key = cellKey(coord);
      const record = cells.get(key)!;
      const capacity = blocks[record.blockId]?.structuralCapacity ?? 0;
      const ratio = loadAboveThis === 0 ? 0 : capacity <= 0 ? Infinity : loadAboveThis / capacity;
      result.set(key, ratio);
      loadAboveThis += blocks[record.blockId]?.weight ?? 0;
    }
  }
  return result;
}

export function countOverloadedCells(
  cells: ReadonlyMap<string, CellRecord>,
  blocks: Readonly<Record<string, WeightedBlock>>
): number {
  let count = 0;
  for (const ratio of computeLoadRatioMap(cells, blocks).values()) {
    if (ratio > 1) count++;
  }
  return count;
}
