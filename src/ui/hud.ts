import { BLOCKS, BLOCK_REGISTRY } from '../sim/blocks';
import { TIER_UNLOCK_POPULATION, isTierUnlocked, maxBuiltFloor } from '../sim/tiers';
import { useGameStore } from '../sim/store';

const TIER_NAMES = ['무허가 정착', '골목 형성', '수직 도시', '성채', '자치 구역', '메가빌딩'];

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

  // 화면 중앙 하단에 두면 3D 뷰 클릭을 막아버리므로, 오른쪽 가장자리 세로 패널로 둔다.
  const hotbar = document.createElement('div');
  hotbar.style.cssText = `
    position: fixed; top: 260px; right: 12px; bottom: 12px; width: 260px;
    z-index: 20; display: flex; flex-direction: column; gap: 4px;
    overflow-y: auto;
    background: rgba(11, 15, 14, 0.85); border: 1px solid #2c3a37; border-radius: 6px;
    padding: 8px 10px;
  `;
  document.body.appendChild(hotbar);

  const tiers = Array.from(new Set(BLOCKS.map((b) => b.tier))).sort((a, b) => a - b);
  const hotbarButtons: HTMLButtonElement[] = [];

  for (const tier of tiers) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; gap: 4px; margin-bottom: 6px;';

    const label = document.createElement('span');
    label.style.cssText = 'font: 11px/1.3 system-ui, sans-serif; color: #6b7674;';
    row.appendChild(label);
    row.dataset.tier = String(tier);

    const buttonWrap = document.createElement('div');
    buttonWrap.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';
    row.appendChild(buttonWrap);

    for (const block of BLOCKS.filter((b) => b.tier === tier)) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        font: 12px/1.4 system-ui, 'Segoe UI', sans-serif; padding: 5px 9px;
        background: rgba(11, 15, 14, 0.9); color: #d7e3e0; border: 1px solid #2c3a37;
        border-radius: 4px; cursor: pointer;
      `;
      btn.dataset.blockId = block.id;
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        useGameStore.getState().setActiveBlock(block.id);
      });
      buttonWrap.appendChild(btn);
      hotbarButtons.push(btn);
    }

    hotbar.appendChild(row);
  }

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

    const builtFloors = maxBuiltFloor(s.cells);

    hotbar.querySelectorAll<HTMLSpanElement>('div[data-tier] > span').forEach((label) => {
      const tier = Number(label.parentElement!.getAttribute('data-tier'));
      const unlocked = isTierUnlocked(tier, s.population, builtFloors);
      label.textContent = `T${tier} ${TIER_NAMES[tier] ?? ''}${unlocked ? '' : ` (인구 ${TIER_UNLOCK_POPULATION[tier]})`}`;
      label.style.color = unlocked ? '#6b7674' : '#ff3d86';
    });

    hotbarButtons.forEach((btn) => {
      const block = BLOCK_REGISTRY[btn.dataset.blockId!];
      const unlocked = isTierUnlocked(block.tier, s.population, builtFloors);
      const active = block.id === s.activeBlockId;
      btn.textContent = `${block.name} (${fmt(block.cost)})`;
      btn.disabled = !unlocked;
      btn.style.cursor = unlocked ? 'pointer' : 'not-allowed';
      btn.style.opacity = unlocked ? '1' : '0.4';
      btn.style.borderColor = active ? '#42e8dc' : '#2c3a37';
      btn.style.color = active ? '#42e8dc' : '#d7e3e0';
    });
  }

  useGameStore.subscribe(render);
  render();
}
