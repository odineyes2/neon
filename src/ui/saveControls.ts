import { useGameStore } from '../sim/store';

export function mountSaveControls(): void {
  const bar = document.createElement('div');
  bar.style.cssText = `
    position: fixed; bottom: 12px; left: 12px; z-index: 20;
    display: flex; gap: 6px;
  `;
  document.body.appendChild(bar);

  const status = document.createElement('span');
  status.style.cssText = `
    font: 11px/1.6 system-ui, sans-serif; color: #6b7674;
    align-self: center; padding-left: 4px;
  `;
  bar.appendChild(status);

  function makeButton(label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      font: 12px/1.4 system-ui, sans-serif; padding: 6px 10px;
      background: rgba(11, 15, 14, 0.9); color: #d7e3e0; border: 1px solid #2c3a37;
      border-radius: 4px; cursor: pointer;
    `;
    bar.appendChild(btn);
    return btn;
  }

  const saveBtn = makeButton('저장');
  saveBtn.addEventListener('click', () => {
    const ok = useGameStore.getState().saveGame();
    status.textContent = ok ? '저장됨' : '저장 실패';
    window.setTimeout(() => (status.textContent = ''), 2000);
  });

  const resetBtn = makeButton('새로 시작');
  resetBtn.addEventListener('click', () => {
    if (!window.confirm('정말 새로 시작할까요? 지금까지의 진행 상황(저장 포함)이 모두 사라집니다.')) return;
    useGameStore.getState().resetGame();
  });
}
