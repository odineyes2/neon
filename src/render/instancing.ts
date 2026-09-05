import * as THREE from 'three';
import { CELL_SIZE, type CellCoord, MAX_BOUNDS, MAX_HEIGHT, cellToWorldPosition, parseCellKey } from '../sim/grid';
import { BLOCK_REGISTRY, type BlockCategory } from '../sim/blocks';

// 최대 부지(13x13) x 최대 높이(24)를 한 카테고리가 전부 채우는 극단적인 경우까지 넉넉히.
const MAX_INSTANCES_PER_CATEGORY = MAX_BOUNDS.x * MAX_BOUNDS.z * MAX_HEIGHT;

// M3 전까지의 임시 배색: 카테고리별 단색 박스로만 구분한다 (§5.5 팔레트 기반).
// 카테고리마다 별도 InstancedMesh(=별도 드로우콜)를 두는 단순한 구조.
// 카테고리 수만큼만 드로우콜이 늘어나므로(5개) 100 이하 목표에 영향 없다.
const CATEGORY_COLORS: Record<BlockCategory, number> = {
  residential: 0x8a4b2a,
  commerce: 0xf5a623,
  utility: 0x4a5a58,
  access: 0x6b7674,
  civic: 0x42e8dc,
};

export interface CellRecord {
  blockId: string;
}

export interface CellInstancePool {
  meshes: THREE.InstancedMesh[];
  getCoordAt: (mesh: THREE.InstancedMesh, instanceId: number) => CellCoord | null;
  syncCells: (cells: ReadonlyMap<string, CellRecord>) => void;
}

interface CategoryPool {
  mesh: THREE.InstancedMesh;
  indexOf: Map<string, number>;
  keys: string[];
}

export function createCellInstancePool(): CellInstancePool {
  const geometry = new THREE.BoxGeometry(
    CELL_SIZE.x * 0.94,
    CELL_SIZE.y * 0.94,
    CELL_SIZE.z * 0.94
  );
  const dummy = new THREE.Object3D();

  const pools = new Map<BlockCategory, CategoryPool>();
  for (const category of Object.keys(CATEGORY_COLORS) as BlockCategory[]) {
    const material = new THREE.MeshStandardMaterial({
      color: CATEGORY_COLORS[category],
      roughness: 0.85,
      metalness: 0.05,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES_PER_CATEGORY);
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pools.set(category, { mesh, indexOf: new Map(), keys: [] });
  }

  function categoryOf(blockId: string): BlockCategory {
    return BLOCK_REGISTRY[blockId]?.category ?? 'utility';
  }

  function writeInstance(pool: CategoryPool, index: number, key: string): void {
    const pos = cellToWorldPosition(parseCellKey(key));
    dummy.position.set(pos.x, pos.y + CELL_SIZE.y / 2, pos.z);
    dummy.updateMatrix();
    pool.mesh.setMatrixAt(index, dummy.matrix);
  }

  function add(pool: CategoryPool, key: string): void {
    const index = pool.keys.length;
    pool.keys.push(key);
    pool.indexOf.set(key, index);
    writeInstance(pool, index, key);
    pool.mesh.count = pool.keys.length;
    pool.mesh.instanceMatrix.needsUpdate = true;
  }

  // 삭제된 슬롯에 마지막 인스턴스를 옮겨 채워 배열을 밀집 상태로 유지한다(스왑 삭제).
  function removeByKey(pool: CategoryPool, key: string): void {
    const index = pool.indexOf.get(key);
    if (index === undefined) return;
    const lastIndex = pool.keys.length - 1;
    const lastKey = pool.keys[lastIndex];
    if (index !== lastIndex) {
      pool.keys[index] = lastKey;
      pool.indexOf.set(lastKey, index);
      writeInstance(pool, index, lastKey);
    }
    pool.keys.pop();
    pool.indexOf.delete(key);
    pool.mesh.count = pool.keys.length;
    pool.mesh.instanceMatrix.needsUpdate = true;
  }

  function getCoordAt(mesh: THREE.InstancedMesh, instanceId: number): CellCoord | null {
    for (const pool of pools.values()) {
      if (pool.mesh !== mesh) continue;
      const key = pool.keys[instanceId];
      return key ? parseCellKey(key) : null;
    }
    return null;
  }

  function syncCells(cells: ReadonlyMap<string, CellRecord>): void {
    for (const pool of pools.values()) {
      for (const key of [...pool.keys]) {
        if (!cells.has(key)) removeByKey(pool, key);
      }
    }
    for (const [key, record] of cells) {
      const pool = pools.get(categoryOf(record.blockId))!;
      if (!pool.indexOf.has(key)) add(pool, key);
    }
    // boundingSphere는 최초 계산 후 캐시되므로, 인스턴스가 바뀔 때마다 다시 계산해야
    // 레이캐스트(배치/철거 판정)와 프러스텀 컬링이 최신 상태를 본다.
    for (const pool of pools.values()) pool.mesh.computeBoundingSphere();
  }

  return {
    meshes: Array.from(pools.values(), (p) => p.mesh),
    getCoordAt,
    syncCells,
  };
}
