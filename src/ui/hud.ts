import { BLOCKS, BLOCK_REGISTRY } from '../sim/blocks';
import { useGameStore } from '../sim/store';

function fmt(value: number, digits = 0): string {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function mountHud(): void {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed; top: 12px; left: 12px; z-index: 20;
    background: rgba(11, 15, 14, 0.85); color: #d7e3e0;
    font: 12px/1.6 ui-monospace, Consolas, monospace;
    padding: 10px 14px; border-radius: 6px; border: 1px solid #2c3a37;
    white-space: pre; pointer-events: none; min-width: 240px;
  `;
  document.body.appendChild(panel);

  const hotbar = document.createElement('div');
  hotbar.style.cssText = `
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    z-index: 20; display: flex; gap: 6px;
  `;
  document.body.appendChild(hotbar);

  const hotbarButtons = BLOCKS.map((block, i) => {
    const btn = document.createElement('button');
    btn.textContent = `${i + 1}. ${block.name}`;
    btn.style.cssText = `
      font: 12px/1.4 system-ui, 'Segoe UI', sans-serif; padding: 6px 10px;
      background: rgba(11, 15, 14, 0.9); color: #d7e3e0; border: 1px solid #2c3a37;
      border-radius: 4px; cursor: pointer;
    `;
    btn.addEventListener('click', () => useGameStore.getState().setActiveBlock(block.id));
    hotbar.appendChild(btn);
    return btn;
  });

  function render(): void {
    const s = useGameStore.getState();
    const stats = s.stats;
    const day = Math.floor(s.tickCount / 24) + 1;
    const hour = s.tickCount % 24;
    const activeBlock = BLOCK_REGISTRY[s.activeBlockId];

    panel.textContent = [
      `${day}일차 ${String(hour).padStart(2, '0')}:00${s.paused ? '  [일시정지 - Space]' : ''}`,
      `크레딧      ${fmt(s.credits)}`,
      `인구/수용력 ${fmt(s.population, 1)} / ${fmt(stats?.housingCapacity ?? 0, 1)}`,
      `전력 수급   ${fmt(stats?.power.balance ?? 0)} (공급 ${fmt(stats?.power.supply ?? 0)} / 수요 ${fmt(stats?.power.demand ?? 0)})`,
      `물 수급     ${fmt(stats?.water.balance ?? 0)} (공급 ${fmt(stats?.water.supply ?? 0)} / 수요 ${fmt(stats?.water.demand ?? 0)})`,
      `오염 ${fmt(stats?.pollution ?? 0)}   소음 ${fmt(stats?.noise ?? 0)}`,
      `질서 ${fmt(stats?.order ?? 0, 1)}   매력 ${fmt(stats?.appeal ?? 0, 1)}`,
      `암흑셀 ${stats?.darkCellCount ?? 0} / 고립셀 ${stats?.isolatedCellCount ?? 0} / 전체 ${stats?.totalCellCount ?? 0}`,
      ``,
      `선택된 블록: ${activeBlock?.name ?? '-'} (${fmt(activeBlock?.cost ?? 0)} 크레딧)`,
    ].join('\n');

    hotbarButtons.forEach((btn, i) => {
      const active = BLOCKS[i].id === s.activeBlockId;
      btn.style.borderColor = active ? '#42e8dc' : '#2c3a37';
      btn.style.color = active ? '#42e8dc' : '#d7e3e0';
    });
  }

  useGameStore.subscribe(render);
  render();
}
