// public/assets/ 아래에 놓일 외부 모델·텍스처를 비동기로 불러오는 공용 로더.
// 파일이 아직 없어도(개발 중 흔한 상태) 절대 throw하지 않고 null로 폴백한다 —
// 호출부는 항상 "지금은 프리미티브 지오메트리/단색 재질을 쓴다"를 기본값으로 두고,
// 로드가 끝나면 조용히 갈아끼우는 방식으로만 이 모듈을 써야 한다.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

const geometryCache = new Map<string, Promise<THREE.BufferGeometry | null>>();
const textureCache = new Map<string, Promise<THREE.Texture | null>>();

function firstMeshGeometry(scene: THREE.Object3D): THREE.BufferGeometry | null {
  let found: THREE.BufferGeometry | null = null;
  scene.traverse((child) => {
    if (found) return;
    if ((child as THREE.Mesh).isMesh) found = (child as THREE.Mesh).geometry;
  });
  return found;
}

/**
 * GLB의 첫 메시 지오메트리를 원점 중심으로 옮기고 target 크기(x,y,z)에
 * 정확히 맞춰 비균등 스케일한다. 킷마다 원본 스케일·피벗이 제각각이라
 * (§ASSET_MANIFEST 참고) 이 정규화 없이는 InstancedMesh 배치 수식이
 * 가정하는 크기와 어긋난다.
 */
function normalizeToBounds(geometry: THREE.BufferGeometry, target: THREE.Vector3): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(
    size.x > 1e-6 ? target.x / size.x : 1,
    size.y > 1e-6 ? target.y / size.y : 1,
    size.z > 1e-6 ? target.z / size.z : 1
  );
  return geometry;
}

/**
 * GLB 모델을 불러와 target 크기로 정규화한 지오메지를 돌려준다.
 * 파일이 없거나(404) 파싱에 실패하면 null — 호출부는 폴백 지오메트리를 유지한다.
 */
export function loadModelGeometry(url: string, target: THREE.Vector3): Promise<THREE.BufferGeometry | null> {
  const cacheKey = `${url}|${target.x},${target.y},${target.z}`;
  let cached = geometryCache.get(cacheKey);
  if (!cached) {
    cached = gltfLoader
      .loadAsync(url)
      .then((gltf) => {
        const geometry = firstMeshGeometry(gltf.scene);
        return geometry ? normalizeToBounds(geometry.clone(), target) : null;
      })
      .catch(() => null);
    geometryCache.set(cacheKey, cached);
  }
  return cached;
}

/**
 * 텍스처를 불러와 sRGB 색공간과 반복 래핑을 설정해 돌려준다.
 * 파일이 없으면 null — 호출부는 무늬 없는 단색 재질을 유지한다.
 */
export function loadTexture(url: string): Promise<THREE.Texture | null> {
  let cached = textureCache.get(url);
  if (!cached) {
    cached = textureLoader
      .loadAsync(url)
      .then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
      })
      .catch(() => null);
    textureCache.set(url, cached);
  }
  return cached;
}

/** roughness/normal 맵처럼 색공간 변환이 없어야 하는 데이터 텍스처용. */
export function loadDataTexture(url: string): Promise<THREE.Texture | null> {
  let cached = textureCache.get(url);
  if (!cached) {
    cached = textureLoader
      .loadAsync(url)
      .then((texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
      })
      .catch(() => null);
    textureCache.set(url, cached);
  }
  return cached;
}
