import * as THREE from 'three';
import type { SkySystem } from './sky';

// 밤 프리셋이 기본 프레젠테이션. 낮은 색이 빠지고 회색빛으로 [확정, §5.5].
// 하늘은 지평선(bottom)->천정(top) 그라디언트. 지평선 쪽을 씬 배경/안개 색으로도
// 써서 도시 실루엣이 하늘과 자연스럽게 만난다.
const NIGHT_SKY_TOP = new THREE.Color(0x03040a);
const NIGHT_SKY_BOTTOM = new THREE.Color(0x141b24);
const DAY_SKY_TOP = new THREE.Color(0x5b6b6f);
const DAY_SKY_BOTTOM = new THREE.Color(0x8a9490);

const NIGHT_SUN_COLOR = new THREE.Color(0x6f86b0);
const DAY_SUN_COLOR = new THREE.Color(0xfff2e0);

// 예전엔 밤에 ambient 0.15 / 태양광 0.2로 화면이 거의 안 보일 정도로 어두웠다.
// 네온이 부각되는 무드는 유지하되, 셸 자체의 색과 형태는 밤에도 식별 가능한
// 최소한의 밝기까지 올린다.
const NIGHT_AMBIENT = 0.32;
const DAY_AMBIENT = 0.6;
const NIGHT_SUN_INTENSITY = 0.35;
const DAY_SUN_INTENSITY = 1.2;

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
  sky: SkySystem;
}

export function createDayNightController({
  scene,
  sun,
  ambient,
  neonMaterials,
  sky,
}: DayNightParams): DayNightController {
  const skyTop = new THREE.Color();
  const skyBottom = new THREE.Color();

  function update(hour: number): void {
    const day = dayFactor(hour);
    const night = 1 - day;

    skyTop.copy(NIGHT_SKY_TOP).lerp(DAY_SKY_TOP, day);
    skyBottom.copy(NIGHT_SKY_BOTTOM).lerp(DAY_SKY_BOTTOM, day);
    sky.update({ topColor: skyTop, bottomColor: skyBottom, starOpacity: night * 0.85 });

    // 지평선 색을 배경/안개로도 써서 먼 셸이 하늘과 자연스럽게 섞이게 한다.
    scene.background = skyBottom.clone();
    if (scene.fog && 'color' in scene.fog) (scene.fog as THREE.Fog).color.copy(skyBottom);

    sun.color.copy(NIGHT_SUN_COLOR).lerp(DAY_SUN_COLOR, day);
    sun.intensity = NIGHT_SUN_INTENSITY + day * (DAY_SUN_INTENSITY - NIGHT_SUN_INTENSITY);
    ambient.intensity = NIGHT_AMBIENT + day * (DAY_AMBIENT - NIGHT_AMBIENT);

    // 정전을 눈으로 본다: 네온은 밤에만 확 밝아진다 [확정, §4.4].
    const neonIntensity = 0.15 + night * 2.4;
    for (const material of neonMaterials) material.emissiveIntensity = neonIntensity;
  }

  return { update };
}
