import { describe, expect, it } from 'vitest';
import { cellKey } from '../src/sim/grid';
import { tick, type TickState } from '../src/sim/tick';
import { BLOCK_REGISTRY, BLOCKS } from '../src/sim/blocks';

// §10 성능 목표(4,000셀)에서 tick() 하나가 틱 간격(1.2초)보다 훨씬 빨리 끝나야
// 게임 시계가 밀리지 않는다. 예전엔 하중/시너지 계산이 셀마다 전체 셀을 다시
// 훑는 O(n^2)라 4000셀에서 틱 하나에 13.8초가 걸렸다(structure.ts의
// computeLoadRatioMap, adjacency.ts의 층별 그룹화로 고침). 이 테스트는 그
// 회귀를 다시 만들지 않는지 지킨다.
function buildCells(count: number): Map<string, { blockId: string }> {
  const cells = new Map<string, { blockId: string }>();
  const blockIds = BLOCKS.map((b) => b.id);
  let i = 0;
  for (let y = 0; y < 24 && i < count; y++) {
    for (let x = -6; x <= 6 && i < count; x++) {
      for (let z = -6; z <= 6 && i < count; z++) {
        cells.set(cellKey({ x, y, z }), { blockId: blockIds[i % blockIds.length] });
        i++;
      }
    }
  }
  return cells;
}

describe('performance', () => {
  it('runs one tick over 4,000 cells well within the 1.2s tick interval', () => {
    const cells = buildCells(4000);
    const state: TickState = {
      cells,
      population: 100,
      credits: 10_000,
      modifiers: { appeal: 0, order: 0 },
      eventFlags: new Set(),
      firedEventIds: new Set(),
      tickCount: 0,
    };

    const start = performance.now();
    tick(state, BLOCK_REGISTRY);
    const elapsed = performance.now() - start;

    // 넉넉한 여유를 두고 500ms — 실제 관측치는 100ms 미만이었다.
    expect(elapsed).toBeLessThan(500);
  });
});
