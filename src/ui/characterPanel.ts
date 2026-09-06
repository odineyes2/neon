import { CHARACTER_REGISTRY } from '../sim/characters';
import { useGameStore } from '../sim/store';

export function mountCharacterPanel(): void {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed; top: 210px; left: 12px; z-index: 20;
    background: rgba(11, 15, 14, 0.85); color: #d7e3e0;
    font: 12px/1.6 system-ui, 'Segoe UI', sans-serif;
    padding: 10px 14px; border-radius: 6px; border: 1px solid #2c3a37;
    min-width: 240px; max-height: calc(100vh - 230px); overflow-y: auto;
  `;
  document.body.appendChild(panel);

  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
    z-index: 30; display: none;
    background: rgba(255, 61, 134, 0.15); color: #ff3d86;
    border: 1px solid #ff3d86; border-radius: 6px;
    font: 13px/1.5 system-ui, sans-serif; padding: 8px 16px;
  `;
  document.body.appendChild(toast);

  let toastTimer: number | undefined;

  function render(): void {
    const { characterRoster, departureNotice } = useGameStore.getState();

    if (characterRoster.size === 0) {
      panel.innerHTML = '<div style="color:#6b7674">아직 합류한 사람이 없다</div>';
    } else {
      panel.innerHTML = '';
      const title = document.createElement('div');
      title.textContent = `주민 (${characterRoster.size})`;
      title.style.cssText = 'color:#6b7674; margin-bottom:6px;';
      panel.appendChild(title);

      for (const [id, state] of characterRoster) {
        const character = CHARACTER_REGISTRY[id];
        if (!character) continue;
        const stage = character.quest[state.questStage];
        const row = document.createElement('div');
        row.style.cssText = 'margin-bottom: 6px;';
        row.innerHTML = `<strong>${character.name}</strong> <span style="color:#6b7674">${character.role}</span><br/><span style="color:#42e8dc">${stage?.title ?? ''}</span>`;
        panel.appendChild(row);
      }
    }

    if (departureNotice.length > 0) {
      toast.textContent = `${departureNotice.join(', ')}${departureNotice.length > 1 ? '이(가)' : '이(가)'} 성채를 떠났다.`;
      toast.style.display = 'block';
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        toast.style.display = 'none';
        useGameStore.getState().clearDepartureNotice();
      }, 4000);
    }
  }

  useGameStore.subscribe(render);
  render();
}
