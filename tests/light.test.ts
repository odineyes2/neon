import { describe, expect, it } from 'vitest';
import { cellKey } from '../src/sim/grid';
import { exposedFaceCount, isDarkCell, lightAppealDelta, makeLightwellOpenCheck } from '../src/sim/light';
import type { BlockDef } from '../src/sim/blocks';

describe('exposedFaceCount', () => {
  it('is fully exposed (5 faces) for a lone ground cell', () => {
    const cells = new Set([cellKey({ x: 0, y: 0, z: 0 })]);
    expect(exposedFaceCount(cells, { x: 0, y: 0, z: 0 })).toBe(5);
  });

  it('drops by one for each occupied lateral/roof neighbor', () => {
    const cells = new Set([
      cellKey({ x: 0, y: 0, z: 0 }),
      cellKey({ x: 1, y: 0, z: 0 }),
      cellKey({ x: 0, y: 1, z: 0 }), // 옥상 위 셀
    ]);
    expect(exposedFaceCount(cells, { x: 0, y: 0, z: 0 })).toBe(3);
  });

  it('ignores the floor below (not part of the 5 counted faces)', () => {
    const cells = new Set([cellKey({ x: 0, y: 1, z: 0 }), cellKey({ x: 0, y: 0, z: 0 })]);
    // (0,1,0)의 아래(0,0,0)는 채워져 있지만, 바닥면은 애초에 세지 않는다.
    expect(exposedFaceCount(cells, { x: 0, y: 1, z: 0 })).toBe(5);
  });

  it('is a dark cell when surrounded on all 5 counted faces', () => {
    const center = { x: 0, y: 1, z: 0 };
    const cells = new Set([
      cellKey(center),
      cellKey({ x: 1, y: 1, z: 0 }),
      cellKey({ x: -1, y: 1, z: 0 }),
      cellKey({ x: 0, y: 1, z: 1 }),
      cellKey({ x: 0, y: 1, z: -1 }),
      cellKey({ x: 0, y: 2, z: 0 }),
    ]);
    expect(isDarkCell(cells, center)).toBe(true);
  });
});

describe('makeLightwellOpenCheck', () => {
  const blocks: Record<string, BlockDef> = {
    room: { category: 'residential' } as BlockDef,
    shaft: { category: 'lightwell' } as BlockDef,
  };

  it('treats a lightwell neighbor as open even though the cell is occupied', () => {
    const center = { x: 0, y: 0, z: 0 };
    const cells = new Map([
      [cellKey(center), { blockId: 'room' }],
      [cellKey({ x: 1, y: 0, z: 0 }), { blockId: 'shaft' }],
      [cellKey({ x: -1, y: 0, z: 0 }), { blockId: 'room' }],
    ]);
    const isOpen = makeLightwellOpenCheck(cells, blocks);
    // 광정 쪽(+x)은 열려 있고, 진짜 방(-x)은 막혀 있다.
    expect(exposedFaceCount(cells, center, isOpen)).toBe(4); // 5면 중 -x만 막힘
  });
});

describe('lightAppealDelta', () => {
  it('penalizes NEEDS_LIGHT blocks in the dark', () => {
    expect(lightAppealDelta(true, 'NEEDS_LIGHT')).toBeLessThan(0);
    expect(lightAppealDelta(false, 'NEEDS_LIGHT')).toBe(0);
  });

  it('rewards PREFERS_DARK blocks in the dark', () => {
    expect(lightAppealDelta(true, 'PREFERS_DARK')).toBeGreaterThan(0);
    expect(lightAppealDelta(false, 'PREFERS_DARK')).toBe(0);
  });

  it('is neutral for INDIFFERENT blocks either way', () => {
    expect(lightAppealDelta(true, 'INDIFFERENT')).toBe(0);
    expect(lightAppealDelta(false, 'INDIFFERENT')).toBe(0);
  });
});
