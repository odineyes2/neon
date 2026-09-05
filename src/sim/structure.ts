// 지지·철거 판정. three.js 비의존.

import { type CellCoord, type PlotBounds, cellKey, isWithinBounds, lateralNeighbors } from './grid';

export function hasDirectSupport(cells: ReadonlySet<string>, coord: CellCoord): boolean {
  return coord.y === 0 || cells.has(cellKey({ x: coord.x, y: coord.y - 1, z: coord.z }));
}

// 셀은 바로 아래 셀이 있거나, 그 자체로 지지된(캔틸레버가 아닌) 인접 셀에 기대어
// 1칸까지 캔틸레버로 버틸 수 있다. 2칸 이상의 연쇄 돌출은 허용하지 않는다.
export function isSupported(cells: ReadonlySet<string>, coord: CellCoord): boolean {
  if (hasDirectSupport(cells, coord)) return true;
  return lateralNeighbors(coord).some(
    (neighbor) => cells.has(cellKey(neighbor)) && hasDirectSupport(cells, neighbor)
  );
}

export interface RuleCheck {
  allowed: boolean;
  reason?: string;
}

export function canPlace(cells: ReadonlySet<string>, coord: CellCoord, bounds: PlotBounds): RuleCheck {
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

export function canDemolish(cells: ReadonlySet<string>, coord: CellCoord): RuleCheck {
  const above = cellKey({ x: coord.x, y: coord.y + 1, z: coord.z });
  if (cells.has(above)) {
    return { allowed: false, reason: '위층이 얹혀 있어 철거할 수 없다' };
  }
  return { allowed: true };
}
