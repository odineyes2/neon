import * as THREE from 'three';
import { CELL_SIZE, MAX_BOUNDS, MAX_HEIGHT, cellKey, cellToWorldPosition, parseCellKey } from '../sim/grid';
import { BLOCK_REGISTRY } from '../sim/blocks';
import { computeAccess } from '../sim/access';
import { exposedFaceCount } from '../sim/light';
import { loadRatio } from '../sim/structure';
import { computeSpatialField } from '../sim/fields';
import type { OverlayMode } from '../sim/store';

interface CellRecord {
  blockId: string;
}

const MAX_MARKERS = MAX_BOUNDS.x * MAX_BOUNDS.z * MAX_HEIGHT;

// 색상 + 형태를 같이 바꿔 색맹이어도 구분되게 한다 [§10 접근성].
const BUCKETS = [
  { color: 0x42e8dc, geometry: () => new THREE.SphereGeometry(0.12, 10, 8) }, // 양호: 시안 구
  { color: 0xf5a623, geometry: () => new THREE.BoxGeometry(0.2, 0.2, 0.2) }, // 주의: 호박 큐브
  { color: 0xff3d86, geometry: () => new THREE.OctahedronGeometry(0.16) }, // 위험: 자홍 팔면체
] as const;

const NOISE_RADIUS = 3;
const POLLUTION_RADIUS = 2;

function bucketFor(mode: OverlayMode, value: number): number {
  switch (mode) {
    case 'light':
    case 'access':
      return value > 0.5 ? 2 : 0;
    case 'load':
      return value > 1 ? 2 : value > 0.7 ? 1 : 0;
    case 'noise':
      return value > 6 ? 2 : value > 2 ? 1 : 0;
    case 'pollution':
      return value > 5 ? 2 : value > 1.5 ? 1 : 0;
    default:
      return 0;
  }
}

export interface OverlaySystem {
  meshes: THREE.Object3D[];
  rebuild: (cells: ReadonlyMap<string, CellRecord>, mode: OverlayMode) => void;
}

export function createOverlaySystem(): OverlaySystem {
  const meshes = BUCKETS.map(({ color, geometry }) => {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.InstancedMesh(geometry(), material, MAX_MARKERS);
    mesh.count = 0;
    return mesh;
  });

  const dummy = new THREE.Object3D();

  function rebuild(cells: ReadonlyMap<string, CellRecord>, mode: OverlayMode): void {
    if (mode === 'none' || cells.size === 0) {
      for (const mesh of meshes) mesh.count = 0;
      return;
    }

    const access = mode === 'access' || mode === 'load' ? computeAccess(cells, BLOCK_REGISTRY) : null;
    const noiseField =
      mode === 'noise' ? computeSpatialField(cells, BLOCK_REGISTRY, (b) => b.emits.noise ?? 0, NOISE_RADIUS) : null;
    const pollutionField =
      mode === 'pollution'
        ? computeSpatialField(cells, BLOCK_REGISTRY, (b) => b.emits.pollution ?? 0, POLLUTION_RADIUS)
        : null;

    const counts = [0, 0, 0];

    for (const key of cells.keys()) {
      const coord = parseCellKey(key);
      let value = 0;

      if (mode === 'light') {
        value = exposedFaceCount(cells, coord) === 0 ? 1 : 0;
      } else if (mode === 'access') {
        value = access!.isolated.has(key) ? 1 : 0;
      } else if (mode === 'load') {
        const ratio = loadRatio(cells, BLOCK_REGISTRY, coord);
        value = Number.isFinite(ratio) ? ratio : 999;
      } else if (mode === 'noise') {
        value = noiseField!.get(key) ?? 0;
      } else if (mode === 'pollution') {
        value = pollutionField!.get(key) ?? 0;
      }

      const bucket = bucketFor(mode, value);
      const pos = cellToWorldPosition(coord);
      // 바로 위 칸이 막혀 있으면 마커가 그 블록 속에 파묻혀 안 보이므로 옆으로 뺀다.
      const blockedAbove = cells.has(cellKey({ x: coord.x, y: coord.y + 1, z: coord.z }));
      if (blockedAbove) {
        // 셸의 실제 반너비(0.94 스케일)보다 더 바깥으로 빼야 셸 속에 파묻히지 않는다.
        dummy.position.set(pos.x + CELL_SIZE.x * 0.6, pos.y + CELL_SIZE.y * 0.5, pos.z);
      } else {
        dummy.position.set(pos.x, pos.y + CELL_SIZE.y + 0.15, pos.z);
      }
      dummy.updateMatrix();
      meshes[bucket].setMatrixAt(counts[bucket]++, dummy.matrix);
    }

    meshes.forEach((mesh, i) => {
      mesh.count = counts[i];
      mesh.instanceMatrix.needsUpdate = true;
      if (counts[i] > 0) mesh.computeBoundingSphere();
    });
  }

  return { meshes, rebuild };
}
