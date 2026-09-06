const SEEN_KEY = 'neon:onboarding-seen:v1';

function hasSeenOnboarding(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false; // 저장 공간이 없으면 매번 보여줘도 그만이다
  }
}

function markOnboardingSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* 못 남기면 다음에 또 보일 뿐, 치명적이지 않다 */
  }
}

export function mountOnboarding(): void {
  if (hasSeenOnboarding()) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 50;
    display: flex; align-items: center; justify-content: center;
    background: rgba(11, 15, 14, 0.75);
  `;
  document.body.appendChild(overlay);

  const card = document.createElement('div');
  card.style.cssText = `
    background: #121917; border: 1px solid #2c3a37; border-radius: 8px;
    padding: 24px; max-width: 460px; color: #d7e3e0;
    font: 14px/1.7 system-ui, 'Segoe UI', sans-serif;
  `;
  overlay.appendChild(card);

  card.innerHTML = `
    <h2 style="margin:0 0 12px; font-size:18px; color:#42e8dc;">無許可 / NO PERMIT</h2>
    <p style="margin:0 0 12px;">허가받지 않은 땅에 컨테이너 하나를 내려놓고, 스스로를 도시라고 부르게 되는
    수직 슬럼을 짓는다. 붙여 지으면 수입은 오르지만 채광·환기·통행은 죽는다.</p>
    <ul style="margin:0 0 16px; padding-left:18px;">
      <li><strong>좌클릭</strong>: 하단 목록에서 고른 블록을 배치</li>
      <li><strong>우클릭</strong>: 철거 (위층이 있으면 안 됨)</li>
      <li><strong>드래그</strong>: 카메라 회전, <strong>스크롤</strong>: 확대/축소</li>
      <li><strong>Space</strong>: 일시정지</li>
      <li>오른쪽 위: <strong>층 슬라이스 · X-ray · 오버레이</strong>(채광/접근성/하중/소음/오염)</li>
      <li>인구가 늘면 더 높은 티어의 블록과 사람들이 해금된다</li>
    </ul>
    <button id="onboarding-close" style="
      font: 13px/1.4 system-ui, sans-serif; padding: 8px 16px;
      background: #42e8dc; color: #0b0f0e; border: none; border-radius: 4px;
      font-weight: 600; cursor: pointer;
    ">시작한다</button>
  `;

  card.querySelector('#onboarding-close')!.addEventListener('click', () => {
    overlay.remove();
    markOnboardingSeen();
  });
}
