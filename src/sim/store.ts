import { create } from 'zustand';
import { type CellCoord, START_BOUNDS, cellKey } from './grid';
import { type RuleCheck, canDemolish, canPlace } from './structure';

interface GameStore {
  cells: ReadonlySet<string>;
  bounds: { x: number; z: number };
  placeCell: (coord: CellCoord) => RuleCheck;
  removeCell: (coord: CellCoord) => RuleCheck;
}

export const useGameStore = create<GameStore>((set, get) => ({
  cells: new Set<string>(),
  bounds: { x: START_BOUNDS.x, z: START_BOUNDS.z },

  placeCell: (coord) => {
    const { cells, bounds } = get();
    const check = canPlace(cells, coord, bounds);
    if (check.allowed) {
      const next = new Set(cells);
      next.add(cellKey(coord));
      set({ cells: next });
    }
    return check;
  },

  removeCell: (coord) => {
    const { cells } = get();
    const check = canDemolish(cells, coord);
    if (check.allowed) {
      const next = new Set(cells);
      next.delete(cellKey(coord));
      set({ cells: next });
    }
    return check;
  },
}));
