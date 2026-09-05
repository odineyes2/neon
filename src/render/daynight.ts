import * as THREE from 'three';

// 밤 프리셋이 기본 프레젠테이션. 낮은 색이 빠지고 회색빛으로 [확정, §5.5].
const NIGHT_SKY = new THREE.Color(0x0b0f0e);
const DAY_SKY = new THREE.Color(0x4d5652);

const NIGHT_SUN_COLOR = new THREE.Color(0x6f86b0);
const DAY_SUN_COLOR = new THREE.Color(0xfff2e0);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// 0 = 완전한 밤, 1 = 완전한 낮. 새벽 5~8시, 노을 18~21시 구간을 부드럽게 보간한다.
function dayFactor(hour: number): number {
  const sunrise = smoothstep(5, 8, hour);
  const sunset = 1 - smoothstep(18, 21, hour);
  return Math.min(sunrise, sunset);
}

export interface DayNightController {
  update(hour: number): void;
}

export interface DayNightParams {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  neonMaterials: THREE.MeshStandardMaterial[];
}

export function createDayNightController({ scene, sun, ambient, neonMaterials }: DayNightParams): DayNightController {
  const sky = new THREE.Color();

  function update(hour: number): void {
    const day = dayFactor(hour);
    const night = 1 - day;

    sky.copy(NIGHT_SKY).lerp(DAY_SKY, day);
    scene.background = sky.clone();
    if (scene.fog && 'color' in scene.fog) (scene.fog as THREE.Fog).color.copy(sky);

    sun.color.copy(NIGHT_SUN_COLOR).lerp(DAY_SUN_COLOR, day);
    sun.intensity = 0.2 + day * 1.0;
    ambient.intensity = 0.15 + day * 0.45;

    // 정전을 눈으로 본다: 네온은 밤에만 확 밝아진다 [확정, §4.4].
    const neonIntensity = 0.15 + night * 2.4;
    for (const material of neonMaterials) material.emissiveIntensity = neonIntensity;
  }

  return { update };
}
