import { BLOCKS } from '../sim/blocks';
import { useGameStore } from '../sim/store';

// 1틱 = 게임 내 1시간, 실시간 1.2초 (배속 1x) [확정, §4.4].
const TICK_INTERVAL_MS = 1200;

export function mountControls(): void {
  window.setInterval(() => {
    if (!useGameStore.getState().paused) useGameStore.getState().advanceTick();
  }, TICK_INTERVAL_MS);

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      useGameStore.getState().togglePaused();
      return;
    }
    const index = Number(event.key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < BLOCKS.length) {
      useGameStore.getState().setActiveBlock(BLOCKS[index].id);
    }
  });
}
