import * as THREE from 'three';
import { CELL_SIZE, type CellCoord, MAX_BOUNDS, MAX_HEIGHT, cellKey, cellToWorldPosition, parseCellKey } from '../sim/grid';
import { BLOCK_REGISTRY } from '../sim/blocks';
import { seededRandom } from './hash';

interface CellRecord {
  blockId: string;
}

// 옥상(위쪽)은 별도 프롭 세트(물탱크·안테나)의 몫이라 여기선 측면 4방향만 다룬다.
const LATERAL_FACES: ReadonlyArray<{ dir: CellCoord; label: string }> = [
  { dir: { x: 1, y: 0, z: 0 }, label: '+x' },
  { dir: { x: -1, y: 0, z: 0 }, label: '-x' },
  { dir: { x: 0, y: 0, z: 1 }, label: '+z' },
  { dir: { x: 0, y: 0, z: -1 }, label: '-z' },
];

const MAX_PROPS = MAX_BOUNDS.x * MAX_BOUNDS.z * MAX_HEIGHT * 2;

// 셸(베이스 박스)은 셀 크기의 0.94배로 그려진다(instancing.ts) — 프롭은 그 실제
// 표면 밖에 붙어야 하고, 셀 전체 크기(1.0) 기준으로 계산하면 셸 속에 파묻힌다.
const SHELL_HALF_EXTENT = (CELL_SIZE.x * 0.94) / 2;
const SURFACE_GAP = 0.015;

export interface PropSystem {
  meshes: THREE.Object3D[];
  neonMaterials: THREE.MeshStandardMaterial[];
  rebuild: (cells: ReadonlyMap<string, CellRecord>) => void;
}

export function createPropSystem(): PropSystem {
  const acMaterial = new THREE.MeshStandardMaterial({ color: 0x556155, roughness: 0.6, metalness: 0.2 });
  const acMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.22, 0.16), acMaterial, MAX_PROPS);
  acMesh.count = 0;
  acMesh.castShadow = true;

  const neonCyan = new THREE.MeshStandardMaterial({
    color: 0x0c3f3c,
    emissive: 0x42e8dc,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const neonMagenta = new THREE.MeshStandardMaterial({
    color: 0x3f0c2c,
    emissive: 0xff3d86,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const neonGeometry = new THREE.BoxGeometry(0.55, 0.28, 0.05);
  const neonMeshCyan = new THREE.InstancedMesh(neonGeometry, neonCyan, MAX_PROPS);
  const neonMeshMagenta = new THREE.InstancedMesh(neonGeometry, neonMagenta, MAX_PROPS);
  neonMeshCyan.count = 0;
  neonMeshMagenta.count = 0;

  const dummy = new THREE.Object3D();
  const outward = new THREE.Vector3();

  function placeOnFace(
    mesh: THREE.InstancedMesh,
    index: number,
    cellCenter: { x: number; y: number; z: number },
    face: { dir: CellCoord },
    depth: number,
    jitter: { x: number; y: number }
  ): void {
    // 프롭 중심을 "셸 표면 + 여유 간격 + 프롭 두께 절반"만큼 밖으로 밀어내
    // 셸 속에 파묻히지 않고 표면 위에 얹힌 것처럼 보이게 한다.
    const distance = SHELL_HALF_EXTENT + SURFACE_GAP + depth / 2;
    outward.set(face.dir.x, face.dir.y, face.dir.z);
    dummy.position.set(
      cellCenter.x + face.dir.x * distance + jitter.x * (face.dir.x === 0 ? 1 : 0),
      cellCenter.y + jitter.y,
      cellCenter.z + face.dir.z * distance + jitter.x * (face.dir.z === 0 ? 1 : 0)
    );
    dummy.lookAt(dummy.position.clone().add(outward));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }

  function rebuild(cells: ReadonlyMap<string, CellRecord>): void {
    let acCount = 0;
    let cyanCount = 0;
    let magentaCount = 0;

    for (const [key, record] of cells) {
      const coord = parseCellKey(key);
      const center = cellToWorldPosition(coord);
      center.y += CELL_SIZE.y / 2;
      const block = BLOCK_REGISTRY[record.blockId];
      if (!block) continue;

      for (const face of LATERAL_FACES) {
        const neighborKey = cellKey({ x: coord.x + face.dir.x, y: coord.y, z: coord.z + face.dir.z });
        if (cells.has(neighborKey)) continue; // 막힌 면에는 프롭을 붙이지 않는다

        const rand = seededRandom(key, face.label);

        if (block.category === 'commerce' && rand() < 0.7) {
          const useCyan = rand() < 0.5;
          const mesh = useCyan ? neonMeshCyan : neonMeshMagenta;
          const index = useCyan ? cyanCount++ : magentaCount++;
          placeOnFace(mesh, index, center, face, 0.05, {
            x: (rand() - 0.5) * 0.3,
            y: (rand() - 0.5) * 0.3,
          });
          continue;
        }

        if (rand() < 0.5) {
          const acJitterCount = 1 + Math.floor(rand() * 2); // 1~2개
          for (let i = 0; i < acJitterCount && acCount < MAX_PROPS; i++) {
            placeOnFace(acMesh, acCount++, center, face, 0.16, {
              x: (rand() - 0.5) * 0.5,
              y: (rand() - 0.5) * 0.6,
            });
          }
        }
      }
    }

    acMesh.count = acCount;
    acMesh.instanceMatrix.needsUpdate = true;
    acMesh.computeBoundingSphere();

    neonMeshCyan.count = cyanCount;
    neonMeshCyan.instanceMatrix.needsUpdate = true;
    neonMeshCyan.computeBoundingSphere();

    neonMeshMagenta.count = magentaCount;
    neonMeshMagenta.instanceMatrix.needsUpdate = true;
    neonMeshMagenta.computeBoundingSphere();
  }

  return {
    meshes: [acMesh, neonMeshCyan, neonMeshMagenta],
    neonMaterials: [neonCyan, neonMagenta],
    rebuild,
  };
}
