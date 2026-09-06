import { CHARACTER_REGISTRY } from '../sim/characters';
import { useGameStore } from '../sim/store';

function fmt(value: number): string {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

export function mountEventModal(): void {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 40; display: none;
    align-items: center; justify-content: center;
    background: rgba(11, 15, 14, 0.7);
  `;
  document.body.appendChild(overlay);

  const card = document.createElement('div');
  card.style.cssText = `
    background: #121917; border: 1px solid #2c3a37; border-radius: 8px;
    padding: 24px; max-width: 420px; color: #d7e3e0;
    font: 14px/1.6 system-ui, 'Segoe UI', sans-serif;
  `;
  overlay.appendChild(card);

  const speakerEl = document.createElement('div');
  speakerEl.style.cssText = 'color: #42e8dc; font-size: 12px; margin-bottom: 4px;';
  card.appendChild(speakerEl);

  const titleEl = document.createElement('h2');
  titleEl.style.cssText = 'margin: 0 0 12px; font-size: 18px; color: #ff3d86;';
  card.appendChild(titleEl);

  const bodyEl = document.createElement('p');
  bodyEl.style.cssText = 'margin: 0 0 18px; white-space: pre-wrap;';
  card.appendChild(bodyEl);

  const choicesEl = document.createElement('div');
  choicesEl.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  card.appendChild(choicesEl);

  function render(): void {
    const { pendingEvent, credits } = useGameStore.getState();
    if (!pendingEvent) {
      overlay.style.display = 'none';
      return;
    }

    overlay.style.display = 'flex';
    const speaker = CHARACTER_REGISTRY[pendingEvent.speaker];
    speakerEl.textContent = speaker ? `${speaker.name} · ${speaker.role}` : pendingEvent.speaker;
    titleEl.textContent = pendingEvent.title;
    bodyEl.textContent = pendingEvent.body;

    choicesEl.innerHTML = '';
    pendingEvent.choices.forEach((choice, index) => {
      const cost = choice.cost?.credits ?? 0;
      const affordable = cost === 0 || credits >= cost; // 크레딧이 마이너스여도 무료 선택지는 항상 고를 수 있다
      const btn = document.createElement('button');
      btn.textContent = cost > 0 ? `${choice.text} (${fmt(cost)} 크레딧)` : choice.text;
      btn.disabled = !affordable;
      btn.style.cssText = `
        font: 13px/1.4 system-ui, sans-serif; padding: 8px 12px; text-align: left;
        background: rgba(255, 255, 255, 0.05); color: ${affordable ? '#d7e3e0' : '#6b7674'};
        border: 1px solid #2c3a37; border-radius: 4px;
        cursor: ${affordable ? 'pointer' : 'not-allowed'};
      `;
      btn.addEventListener('click', () => useGameStore.getState().resolveEvent(index));
      choicesEl.appendChild(btn);
    });
  }

  useGameStore.subscribe(render);
  render();
}
