import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  update(): void;
}

// 상하 각도 제한: 지면 아래 진입 금지, 거의 수직 위에서 내려다보는 것까지 허용.
const MIN_ELEVATION_DEG = -5;
const MAX_ELEVATION_DEG = 80;

export function createCameraRig(domElement: HTMLElement): CameraRig {
  const camera = new THREE.PerspectiveCamera(
    50,
    domElement.clientWidth / domElement.clientHeight,
    0.1,
    600 // 스카이돔(반지름 450)이 카메라 궤도(최대 60) 밖에서도 잘리지 않을 여유
  );
  camera.position.set(10, 10, 10);

  const controls = new OrbitControls(camera, domElement);
  controls.target.set(0, 2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3;
  controls.maxDistance = 60;

  // OrbitControls의 극각(polarAngle)은 +y축(정수리)을 0으로 잰다.
  controls.minPolarAngle = THREE.MathUtils.degToRad(90 - MAX_ELEVATION_DEG);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(90 - MIN_ELEVATION_DEG);

  controls.update();

  return {
    camera,
    controls,
    update: () => controls.update(),
  };
}
