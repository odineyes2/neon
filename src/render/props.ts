import * as THREE from 'three';
import { CELL_SIZE, type CellCoord, MAX_BOUNDS, MAX_HEIGHT, cellKey, cellToWorldPosition, parseCellKey } from '../sim/grid';
import { BLOCK_REGISTRY } from '../sim/blocks';
import { seededRandom } from './hash';
import { loadModelGeometry } from './assetLibrary';
import { PROP_MODEL_PATHS, type WiredPropId } from './assetManifest';

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

// block.visual.props에 등장하지만 아직 이 파일에서 다루지 않는 프롭.
// laundry_line·pipe_bundle은 "인접 셀을 잇는" 배치라 이 파일의 단일 면(face)
// 부착 모델과 다른 로직이 필요하고, potted_plant는 외벽이 아니라 통로 위에
// 놓이는 프롭이라 역시 다르다 — 별도 설계가 필요해 이번 스코프에서 제외했다.
const UNIMPLEMENTED_PROPS = new Set(['laundry_line', 'pipe_bundle', 'potted_plant']);

interface SimplePropKind {
  id: WiredPropId;
  geometry: THREE.BoxGeometry; // GLB가 로드되기 전까지 쓰는 폴백
  material: THREE.MeshStandardMaterial;
  depth: number; // 표면에서 얼마나 튀어나오는지 — placeOnFace 오프셋 계산용
  jitter: { x: number; y: number };
  chance: number; // 자격 있는 면에 실제로 배치될 확률
  minCount: number;
  maxCount: number;
}

export interface PropSystem {
  meshes: THREE.Object3D[];
  neonMaterials: THREE.MeshStandardMaterial[];
  rebuild: (cells: ReadonlyMap<string, CellRecord>) => void;
}

export function createPropSystem(): PropSystem {
  const simpleKinds: SimplePropKind[] = [
    {
      id: 'ac_unit',
      geometry: new THREE.BoxGeometry(0.32, 0.22, 0.16),
      material: new THREE.MeshStandardMaterial({ color: 0x556155, roughness: 0.6, metalness: 0.2 }),
      depth: 0.16,
      jitter: { x: 0.5, y: 0.6 },
      chance: 0.5,
      minCount: 1,
      maxCount: 2,
    },
    {
      id: 'steam_vent',
      geometry: new THREE.BoxGeometry(0.14, 0.14, 0.1),
      material: new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.7, metalness: 0.3 }),
      depth: 0.1,
      jitter: { x: 0.35, y: 0.3 },
      chance: 0.6,
      minCount: 1,
      maxCount: 1,
    },
    {
      id: 'exhaust_pipe',
      geometry: new THREE.BoxGeometry(0.1, 0.6, 0.1),
      material: new THREE.MeshStandardMaterial({ color: 0x3a3f3d, roughness: 0.5, metalness: 0.5 }),
      depth: 0.1,
      jitter: { x: 0.3, y: 0 },
      chance: 0.7,
      minCount: 1,
      maxCount: 1,
    },
  ];

  const simpleMeshes = new Map<WiredPropId, THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>();
  for (const kind of simpleKinds) {
    const mesh = new THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>(
      kind.geometry,
      kind.material,
      MAX_PROPS
    );
    mesh.count = 0;
    mesh.castShadow = true;
    simpleMeshes.set(kind.id, mesh);
    // GLB가 도착하면 폴백 지오메트리를 조용히 갈아끼운다. 인스턴스 트랜스폼은
    // geometry와 독립이라 rebuild를 다시 부를 필요는 없다.
    const { width, height, depth } = kind.geometry.parameters;
    void loadModelGeometry(PROP_MODEL_PATHS[kind.id], new THREE.Vector3(width, height, depth)).then((geometry) => {
      if (geometry) mesh.geometry = geometry;
    });
  }

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
  const neonFallbackGeometry = new THREE.BoxGeometry(0.55, 0.28, 0.05);
  const neonMeshCyan = new THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>(
    neonFallbackGeometry,
    neonCyan,
    MAX_PROPS
  );
  const neonMeshMagenta = new THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>(
    neonFallbackGeometry,
    neonMagenta,
    MAX_PROPS
  );
  neonMeshCyan.count = 0;
  neonMeshMagenta.count = 0;
  void loadModelGeometry(PROP_MODEL_PATHS.neon_sign, new THREE.Vector3(0.55, 0.28, 0.05)).then((geometry) => {
    if (!geometry) return;
    neonMeshCyan.geometry = geometry;
    neonMeshMagenta.geometry = geometry;
  });

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
    const counts = new Map<WiredPropId, number>(simpleKinds.map((k) => [k.id, 0]));
    let cyanCount = 0;
    let magentaCount = 0;

    for (const [key, record] of cells) {
      const coord = parseCellKey(key);
      const center = cellToWorldPosition(coord);
      center.y += CELL_SIZE.y / 2;
      const block = BLOCK_REGISTRY[record.blockId];
      if (!block) continue;

      const eligible = block.visual.props.filter((id) => !UNIMPLEMENTED_PROPS.has(id));
      if (eligible.length === 0) continue;

      for (const face of LATERAL_FACES) {
        const neighborKey = cellKey({ x: coord.x + face.dir.x, y: coord.y, z: coord.z + face.dir.z });
        if (cells.has(neighborKey)) continue; // 막힌 면에는 프롭을 붙이지 않는다

        const rand = seededRandom(key, face.label);

        if (eligible.includes('neon_sign') && rand() < 0.7) {
          const useCyan = rand() < 0.5;
          const mesh = useCyan ? neonMeshCyan : neonMeshMagenta;
          const index = useCyan ? cyanCount++ : magentaCount++;
          placeOnFace(mesh, index, center, face, 0.05, {
            x: (rand() - 0.5) * 0.3,
            y: (rand() - 0.5) * 0.3,
          });
          continue;
        }

        for (const kind of simpleKinds) {
          if (!eligible.includes(kind.id)) continue;
          if (rand() >= kind.chance) continue;
          const count = kind.minCount + Math.floor(rand() * (kind.maxCount - kind.minCount + 1));
          const mesh = simpleMeshes.get(kind.id)!;
          let n = counts.get(kind.id)!;
          for (let i = 0; i < count && n < MAX_PROPS; i++) {
            placeOnFace(mesh, n++, center, face, kind.depth, {
              x: (rand() - 0.5) * kind.jitter.x,
              y: (rand() - 0.5) * kind.jitter.y,
            });
          }
          counts.set(kind.id, n);
        }
      }
    }

    for (const kind of simpleKinds) {
      const mesh = simpleMeshes.get(kind.id)!;
      mesh.count = counts.get(kind.id)!;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }

    neonMeshCyan.count = cyanCount;
    neonMeshCyan.instanceMatrix.needsUpdate = true;
    neonMeshCyan.computeBoundingSphere();

    neonMeshMagenta.count = magentaCount;
    neonMeshMagenta.instanceMatrix.needsUpdate = true;
    neonMeshMagenta.computeBoundingSphere();
  }

  return {
    meshes: [...simpleMeshes.values(), neonMeshCyan, neonMeshMagenta],
    neonMaterials: [neonCyan, neonMagenta],
    rebuild,
  };
}
