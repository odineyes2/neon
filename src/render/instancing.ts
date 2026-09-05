import * as THREE from 'three';
import { CELL_SIZE, type CellCoord, MAX_BOUNDS, MAX_HEIGHT, cellToWorldPosition, parseCellKey } from '../sim/grid';

// 최대 부지(13x13) x 최대 높이(24)를 넉넉히 덮는 용량.
const MAX_INSTANCES = MAX_BOUNDS.x * MAX_BOUNDS.z * MAX_HEIGHT;

export interface CellInstancePool {
  mesh: THREE.InstancedMesh;
  getCoordAt: (instanceId: number) => CellCoord | null;
  syncCells: (cellKeys: ReadonlySet<string>) => void;
}

export function createCellInstancePool(): CellInstancePool {
  const geometry = new THREE.BoxGeometry(
    CELL_SIZE.x * 0.94,
    CELL_SIZE.y * 0.94,
    CELL_SIZE.z * 0.94
  );
  const material = new THREE.MeshStandardMaterial({ color: 0x8a4b2a, roughness: 0.85, metalness: 0.05 });

  const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const indexOf = new Map<string, number>();
  const keys: string[] = [];
  const dummy = new THREE.Object3D();

  function writeInstance(index: number, key: string): void {
    const pos = cellToWorldPosition(parseCellKey(key));
    dummy.position.set(pos.x, pos.y + CELL_SIZE.y / 2, pos.z);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }

  function add(key: string): void {
    const index = keys.length;
    keys.push(key);
    indexOf.set(key, index);
    writeInstance(index, key);
    mesh.count = keys.length;
    mesh.instanceMatrix.needsUpdate = true;
  }

  // 삭제된 슬롯에 마지막 인스턴스를 옮겨 채워 배열을 밀집 상태로 유지한다(스왑 삭제).
  function removeByKey(key: string): void {
    const index = indexOf.get(key);
    if (index === undefined) return;
    const lastIndex = keys.length - 1;
    const lastKey = keys[lastIndex];
    if (index !== lastIndex) {
      keys[index] = lastKey;
      indexOf.set(lastKey, index);
      writeInstance(index, lastKey);
    }
    keys.pop();
    indexOf.delete(key);
    mesh.count = keys.length;
    mesh.instanceMatrix.needsUpdate = true;
  }

  function getCoordAt(instanceId: number): CellCoord | null {
    const key = keys[instanceId];
    return key ? parseCellKey(key) : null;
  }

  function syncCells(cellKeys: ReadonlySet<string>): void {
    for (const key of [...keys]) {
      if (!cellKeys.has(key)) removeByKey(key);
    }
    for (const key of cellKeys) {
      if (!indexOf.has(key)) add(key);
    }
    // boundingSphere는 최초 계산 후 캐시되므로, 인스턴스가 바뀔 때마다 다시 계산해야
    // 레이캐스트(배치/철거 판정)와 프러스텀 컬링이 최신 상태를 본다.
    mesh.computeBoundingSphere();
  }

  return { mesh, getCoordAt, syncCells };
}
