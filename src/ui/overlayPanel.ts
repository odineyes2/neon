import { MAX_HEIGHT } from '../sim/grid';
import { useGameStore, type OverlayMode } from '../sim/store';

const OVERLAY_LABELS: Array<{ mode: OverlayMode; label: string }> = [
  { mode: 'none', label: '끄기' },
  { mode: 'light', label: '채광' },
  { mode: 'access', label: '접근성' },
  { mode: 'load', label: '하중' },
  { mode: 'noise', label: '소음' },
  { mode: 'pollution', label: '오염' },
];

export function mountOverlayPanel(): void {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed; top: 12px; right: 12px; z-index: 20;
    background: rgba(11, 15, 14, 0.85); color: #d7e3e0;
    font: 12px/1.6 system-ui, 'Segoe UI', sans-serif;
    padding: 10px 14px; border-radius: 6px; border: 1px solid #2c3a37;
    min-width: 180px; display: flex; flex-direction: column; gap: 8px;
  `;
  document.body.appendChild(panel);

  const sliceRow = document.createElement('div');
  const sliceLabel = document.createElement('div');
  sliceLabel.textContent = '층 슬라이스';
  const sliceSlider = document.createElement('input');
  sliceSlider.type = 'range';
  sliceSlider.min = '0';
  sliceSlider.max = String(MAX_HEIGHT - 1);
  sliceSlider.style.width = '100%';
  sliceSlider.addEventListener('input', () => {
    useGameStore.getState().setFloorSlice(Number(sliceSlider.value));
  });
  sliceRow.append(sliceLabel, sliceSlider);
  panel.appendChild(sliceRow);

  const xrayButton = document.createElement('button');
  xrayButton.style.cssText = `
    font: 12px/1.4 system-ui, sans-serif; padding: 6px 10px;
    background: rgba(11, 15, 14, 0.9); color: #d7e3e0; border: 1px solid #2c3a37;
    border-radius: 4px; cursor: pointer;
  `;
  xrayButton.addEventListener('click', () => useGameStore.getState().toggleXray());
  panel.appendChild(xrayButton);

  const overlayLabel = document.createElement('div');
  overlayLabel.textContent = '오버레이';
  panel.appendChild(overlayLabel);

  const overlayRow = document.createElement('div');
  overlayRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';
  const overlayButtons = OVERLAY_LABELS.map(({ mode, label }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      font: 11px/1.3 system-ui, sans-serif; padding: 4px 8px;
      background: rgba(11, 15, 14, 0.9); color: #d7e3e0; border: 1px solid #2c3a37;
      border-radius: 4px; cursor: pointer;
    `;
    btn.addEventListener('click', () => useGameStore.getState().setOverlayMode(mode));
    overlayRow.appendChild(btn);
    return btn;
  });
  panel.appendChild(overlayRow);

  function render(): void {
    const s = useGameStore.getState();
    sliceSlider.value = String(s.floorSlice);
    sliceLabel.textContent = `층 슬라이스: ${s.floorSlice + 1}층까지`;
    xrayButton.textContent = s.xray ? 'X-ray 끄기' : 'X-ray 켜기';
    xrayButton.style.borderColor = s.xray ? '#42e8dc' : '#2c3a37';
    xrayButton.style.color = s.xray ? '#42e8dc' : '#d7e3e0';

    overlayButtons.forEach((btn, i) => {
      const active = OVERLAY_LABELS[i].mode === s.overlayMode;
      btn.style.borderColor = active ? '#ff3d86' : '#2c3a37';
      btn.style.color = active ? '#ff3d86' : '#d7e3e0';
    });
  }

  useGameStore.subscribe(render);
  render();
}
