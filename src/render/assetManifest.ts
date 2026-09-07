// public/assets/ 아래 파일 경로의 단일 소스. 실제 파일을 채우는 방법과
// 출처 팩 추천은 docs/assets/ASSET_MANIFEST.md 참고.
//
// 여기 적힌 경로에 파일이 없어도 게임은 정상 동작한다(assetLibrary가 null로
// 폴백) — 파일을 채워 넣는 것만으로 그래픽이 바뀌고, 코드 수정은 필요 없다.

import type { BlockCategory } from '../sim/blocks';

const MODEL_ROOT = '/assets/models';
const TEXTURE_ROOT = '/assets/textures';

/** props.ts가 실제로 로드를 시도하는 프롭. 나머지(laundry_line, pipe_bundle,
 * potted_plant)는 연결형/맥락형 배치 로직이 아직 없어 이 목록에서 제외했다 —
 * §11(열린 질문) 후속 작업. */
export const WIRED_PROP_IDS = ['ac_unit', 'neon_sign', 'steam_vent', 'exhaust_pipe'] as const;
export type WiredPropId = (typeof WIRED_PROP_IDS)[number];

export const PROP_MODEL_PATHS: Record<WiredPropId, string> = {
  ac_unit: `${MODEL_ROOT}/props/ac_unit.glb`,
  neon_sign: `${MODEL_ROOT}/props/neon_sign_frame.glb`,
  steam_vent: `${MODEL_ROOT}/props/steam_vent.glb`,
  exhaust_pipe: `${MODEL_ROOT}/props/exhaust_pipe.glb`,
};

/** 카테고리별 외장 재질 텍스처. base(셸) 지오메트리는 그대로 두고(레이캐스트
 * 안전성 때문 — ASSET_MANIFEST 참고) map/normalMap/roughnessMap만 입힌다. */
export const CATEGORY_SURFACE_TEXTURE_PATHS: Record<BlockCategory, string> = {
  residential: `${TEXTURE_ROOT}/surface/container_rust`,
  commerce: `${TEXTURE_ROOT}/surface/concrete_grime`,
  utility: `${TEXTURE_ROOT}/surface/steel_panel`,
  access: `${TEXTURE_ROOT}/surface/grate_metal`,
  civic: `${TEXTURE_ROOT}/surface/concrete_clean`,
  lightwell: `${TEXTURE_ROOT}/surface/concrete_clean`,
};

/** `<prefix>_albedo.jpg` 같은 식으로 맵별 파일을 구성한다. albedo 외에는
 * 없어도(null) 그만이라 노멀맵 없는 재질로 자연스럽게 폴백된다. */
export function surfaceTextureUrl(prefix: string, map: 'albedo' | 'normal' | 'roughness'): string {
  return `${prefix}_${map}.jpg`;
}
