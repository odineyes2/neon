import * as THREE from 'three';
import type { CellInstancePool } from './instancing';
import { CELL_SIZE, type CellCoord, cellToWorldPosition } from '../sim/grid';
import { BLOCK_REGISTRY } from '../sim/blocks';
import { checkPlacement, useGameStore } from '../sim/store';

const CLICK_MOVE_THRESHOLD_PX = 5;
const INVALID_TOOLTIP_TIMEOUT_MS = 1600;

interface HoverTarget {
  placeCoord: CellCoord;
  existingCoord: CellCoord | null;
}

export interface PlacementOptions {
  scene: THREE.Scene;
  container: HTMLElement;
  camera: THREE.Camera;
  ground: THREE.Mesh;
  pool: CellInstancePool;
}

export function setupPlacement({ scene, container, camera, ground, pool }: PlacementOptions): void {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(CELL_SIZE.x * 0.96, CELL_SIZE.y * 0.96, CELL_SIZE.z * 0.96),
    new THREE.MeshBasicMaterial({ color: 0x42e8dc, transparent: true, opacity: 0.35, depthWrite: false })
  );
  ghost.visible = false;
  scene.add(ghost);

  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position: fixed;
    pointer-events: none;
    background: rgba(11, 15, 14, 0.92);
    color: #ff3d86;
    font: 12px/1.4 system-ui, 'Segoe UI', sans-serif;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid #ff3d86;
    display: none;
    z-index: 10;
    white-space: nowrap;
  `;
  document.body.appendChild(tooltip);

  let hover: HoverTarget | null = null;
  let downButton: number | null = null;
  let downX = 0;
  let downY = 0;
  let tooltipHideTimer: number | undefined;

  function showTooltip(text: string, clientX: number, clientY: number, timeout?: number): void {
    tooltip.textContent = text;
    tooltip.style.left = `${clientX + 14}px`;
    tooltip.style.top = `${clientY + 14}px`;
    tooltip.style.display = 'block';
    window.clearTimeout(tooltipHideTimer);
    if (timeout) {
      tooltipHideTimer = window.setTimeout(() => {
        tooltip.style.display = 'none';
      }, timeout);
    }
  }

  function hideTooltip(): void {
    window.clearTimeout(tooltipHideTimer);
    tooltip.style.display = 'none';
  }

  function pickHoverTarget(clientX: number, clientY: number): HoverTarget | null {
    const rect = container.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects([...pool.meshes, ground], false);
    if (hits.length === 0) return null;
    const hit = hits[0];

    if (hit.object === ground) {
      const x = Math.round(hit.point.x / CELL_SIZE.x);
      const z = Math.round(hit.point.z / CELL_SIZE.z);
      return { placeCoord: { x, y: 0, z }, existingCoord: null };
    }

    if (hit.instanceId === undefined || !hit.face) return null;
    const baseCoord = pool.getCoordAt(hit.object as THREE.InstancedMesh, hit.instanceId);
    if (!baseCoord) return null;

    const n = hit.face.normal;
    const placeCoord: CellCoord = {
      x: baseCoord.x + Math.round(n.x),
      y: baseCoord.y + Math.round(n.y),
      z: baseCoord.z + Math.round(n.z),
    };
    return { placeCoord, existingCoord: baseCoord };
  }

  function onPointerMove(event: PointerEvent): void {
    hover = pickHoverTarget(event.clientX, event.clientY);
    if (!hover) {
      ghost.visible = false;
      hideTooltip();
      return;
    }

    const { cells, bounds, credits, activeBlockId } = useGameStore.getState();
    const block = BLOCK_REGISTRY[activeBlockId];
    const check = checkPlacement(cells, hover.placeCoord, bounds, block, credits);
    const pos = cellToWorldPosition(hover.placeCoord);
    ghost.position.set(pos.x, pos.y + CELL_SIZE.y / 2, pos.z);
    ghost.visible = true;
    (ghost.material as THREE.MeshBasicMaterial).color.set(check.allowed ? 0x42e8dc : 0xff3d86);

    if (!check.allowed && check.reason) {
      showTooltip(check.reason, event.clientX, event.clientY);
    } else {
      hideTooltip();
    }
  }

  function onPointerDown(event: PointerEvent): void {
    downButton = event.button;
    downX = event.clientX;
    downY = event.clientY;
  }

  function onPointerUp(event: PointerEvent): void {
    if (downButton === null) return;
    const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
    const button = downButton;
    downButton = null;
    if (moved > CLICK_MOVE_THRESHOLD_PX) return; // 궤도 카메라 드래그였다면 무시

    const target = pickHoverTarget(event.clientX, event.clientY);
    if (!target) return;

    if (button === 0) {
      const result = useGameStore.getState().placeCell(target.placeCoord);
      if (!result.allowed && result.reason) {
        showTooltip(result.reason, event.clientX, event.clientY, INVALID_TOOLTIP_TIMEOUT_MS);
      }
    } else if (button === 2 && target.existingCoord) {
      const result = useGameStore.getState().removeCell(target.existingCoord);
      if (!result.allowed && result.reason) {
        showTooltip(result.reason, event.clientX, event.clientY, INVALID_TOOLTIP_TIMEOUT_MS);
      }
    }
  }

  function onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  container.addEventListener('contextmenu', onContextMenu);
}
