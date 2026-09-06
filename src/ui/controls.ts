import { BLOCKS } from '../sim/blocks';
import { isTierUnlocked, maxBuiltFloor } from '../sim/tiers';
import { useGameStore } from '../sim/store';

// 1틱 = 게임 내 1시간, 실시간 1.2초 (배속 1x) [확정, §4.4].
const TICK_INTERVAL_MS = 1200;
// 자동 저장 20초 간격 [확정, §10].
const AUTOSAVE_INTERVAL_MS = 20_000;

export function mountControls(): void {
  window.setInterval(() => {
    if (!useGameStore.getState().paused) useGameStore.getState().advanceTick();
  }, TICK_INTERVAL_MS);

  window.setInterval(() => {
    useGameStore.getState().saveGame();
  }, AUTOSAVE_INTERVAL_MS);

  window.addEventListener('beforeunload', () => {
    useGameStore.getState().saveGame();
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      useGameStore.getState().togglePaused();
      return;
    }

    const index = Number(event.key) - 1;
    if (!Number.isInteger(index) || index < 0) return;

    // 숫자키는 "현재 해금된" 블록 목록 중 index번째를 고른다 (블록이 27종이라
    // 1~9로는 전체를 다 못 덮으니, 하단 패널에서 직접 클릭하는 게 기본 조작이다).
    const { cells, population } = useGameStore.getState();
    const builtFloors = maxBuiltFloor(cells);
    const unlocked = BLOCKS.filter((b) => isTierUnlocked(b.tier, population, builtFloors));
    if (unlocked[index]) useGameStore.getState().setActiveBlock(unlocked[index].id);
  });
}
