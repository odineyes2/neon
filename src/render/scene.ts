import * as THREE from 'three';
import { createCameraRig } from './camera';
import { CELL_SIZE, MAX_BOUNDS } from '../sim/grid';

const COLORS = {
  background: 0x0b0f0e,
  fog: 0x0b0f0e,
  ground: 0x1a2422,
  grid: 0x2c3a37,
} as const;

export function initScene(container: HTMLElement): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
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

  function onResize(): void {
    const { clientWidth, clientHeight } = container;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
  }
  window.addEventListener('resize', onResize);

  renderer.setAnimationLoop(() => {
    updateControls();
    renderer.render(scene, camera);
  });
}
