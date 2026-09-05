import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createCameraRig } from './camera';
import { createCellInstancePool, type CellRecord } from './instancing';
import { createDayNightController } from './daynight';
import { createPropSystem } from './props';
import { createOverlaySystem } from './overlays';
import { setupPlacement } from './placement';
import { CELL_SIZE, MAX_BOUNDS, parseCellKey } from '../sim/grid';
import { useGameStore, type OverlayMode } from '../sim/store';

const XRAY_OPACITY = 0.18;

const COLORS = {
  background: 0x0b0f0e,
  fog: 0x0b0f0e,
  ground: 0x1a2422,
  grid: 0x2c3a37,
  buildable: 0x42e8dc,
} as const;

export function initScene(container: HTMLElement): void {
  // 포스트프로세싱(블룸)을 쓰므로 렌더러 자체 MSAA는 끈다 — 안티앨리어싱은
  // 컴포저의 최종 출력에서 처리하는 게 일반적이고, 렌더러 MSAA와 EffectComposer의
  // 렌더타깃이 섞이면 프레임버퍼 관련 경고가 발생한다.
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.background);
  scene.fog = new THREE.Fog(COLORS.fog, 20, 80);

  const { camera, update: updateControls } = createCameraRig(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff2e0, 1.2);
  sun.position.set(15, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);

  const groundSize = MAX_BOUNDS.x * CELL_SIZE.x;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, MAX_BOUNDS.z * CELL_SIZE.z),
    new THREE.MeshStandardMaterial({ color: COLORS.ground, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(groundSize, MAX_BOUNDS.x, COLORS.grid, COLORS.grid);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  scene.add(grid);

  function buildOutlineGeometry(bounds: { x: number; z: number }): THREE.BufferGeometry {
    const halfX = (bounds.x * CELL_SIZE.x) / 2;
    const halfZ = (bounds.z * CELL_SIZE.z) / 2;
    const corners = new Float32Array([
      -halfX, 0, -halfZ,
      halfX, 0, -halfZ,
      halfX, 0, halfZ,
      -halfX, 0, halfZ,
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(corners, 3));
    return geometry;
  }

  const buildableOutline = new THREE.LineLoop(
    buildOutlineGeometry(useGameStore.getState().bounds),
    new THREE.LineBasicMaterial({ color: COLORS.buildable, transparent: true, opacity: 0.8 })
  );
  buildableOutline.position.y = 0.01;
  scene.add(buildableOutline);

  function updateBuildableOutline(bounds: { x: number; z: number }): void {
    const old = buildableOutline.geometry;
    buildableOutline.geometry = buildOutlineGeometry(bounds);
    old.dispose();
  }

  // 층 슬라이스로 가려진 셀은 렌더링/레이캐스트에서만 제외한다 — 지지·경제 등
  // 시뮬레이션은 항상 store.cells 전체를 기준으로 계산한다 (슬라이스는 뷰일 뿐).
  function visibleCells(state: ReturnType<typeof useGameStore.getState>): ReadonlyMap<string, CellRecord> {
    if (state.floorSlice >= 23) return state.cells;
    const filtered = new Map<string, CellRecord>();
    for (const [key, record] of state.cells) {
      if (parseCellKey(key).y <= state.floorSlice) filtered.set(key, record);
    }
    return filtered;
  }

  function effectiveOverlay(state: ReturnType<typeof useGameStore.getState>): OverlayMode {
    if (state.overlayMode !== 'none') return state.overlayMode;
    return state.xray ? 'light' : 'none';
  }

  const pool = createCellInstancePool();
  for (const mesh of pool.meshes) scene.add(mesh);
  pool.syncCells(visibleCells(useGameStore.getState()));

  const props = createPropSystem();
  for (const mesh of props.meshes) scene.add(mesh);
  props.rebuild(visibleCells(useGameStore.getState()));

  const overlays = createOverlaySystem();
  for (const mesh of overlays.meshes) scene.add(mesh);
  overlays.rebuild(visibleCells(useGameStore.getState()), effectiveOverlay(useGameStore.getState()));

  const dayNight = createDayNightController({ scene, sun, ambient, neonMaterials: props.neonMaterials });
  dayNight.update(useGameStore.getState().tickCount % 24);

  function applyXray(xray: boolean): void {
    for (const material of pool.materials) {
      material.transparent = xray;
      material.opacity = xray ? XRAY_OPACITY : 1;
      material.depthWrite = !xray;
    }
  }

  useGameStore.subscribe((state, prevState) => {
    const cellsChanged = state.cells !== prevState.cells;
    const sliceChanged = state.floorSlice !== prevState.floorSlice;
    const overlayChanged =
      state.overlayMode !== prevState.overlayMode || state.xray !== prevState.xray || cellsChanged || sliceChanged;

    if (cellsChanged || sliceChanged) {
      const visible = visibleCells(state);
      pool.syncCells(visible);
      props.rebuild(visible);
    }
    if (overlayChanged) {
      overlays.rebuild(visibleCells(state), effectiveOverlay(state));
    }
    if (state.xray !== prevState.xray) applyXray(state.xray);
    if (state.bounds !== prevState.bounds) updateBuildableOutline(state.bounds);
    if (state.tickCount !== prevState.tickCount) dayNight.update(state.tickCount % 24);
  });

  setupPlacement({ scene, container, camera, ground, pool });

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    0.55, // strength
    0.4, // radius
    0.9 // threshold: 이미시브(네온)만 번지고 일반 채도 높은 셸/외곽선은 번지지 않게
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  function onResize(): void {
    const { clientWidth, clientHeight } = container;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
    composer.setSize(clientWidth, clientHeight);
    bloomPass.setSize(clientWidth, clientHeight);
  }
  window.addEventListener('resize', onResize);

  renderer.setAnimationLoop(() => {
    updateControls();
    composer.render();
  });
}
