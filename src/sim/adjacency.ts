// 인접 시너지: 블록 쌍/카테고리 기반 효과. three.js 비의존. 콘텐츠는 §4.3 예시.

import { type CellCoord, parseCellKey } from './grid';
import type { BlockDef } from './blocks';

export interface CellRecord {
  blockId: string;
}

export type SynergyEffect =
  | { type: 'income_multiplier'; delta: number }
  | { type: 'appeal_delta'; delta: number }
  | { type: 'order_delta'; delta: number }
  | { type: 'pollution_delta'; delta: number };

export interface SynergyTarget {
  blockId?: string;
  category?: BlockDef['category'];
}

export interface SynergyRule {
  id: string;
  sourceBlockId: string;
  target: SynergyTarget;
  range: number; // 같은 층 기준 체비셰프 거리. 1 = 바로 인접.
  effect: SynergyEffect;
  reciprocal?: boolean; // true면 대상도 같은 효과를 소스에 되돌려준다 (상호 시너지)
}

export const SYNERGY_RULES: readonly SynergyRule[] = [
  {
    id: 'alley_market',
    sourceBlockId: 'noodle_shop',
    target: { blockId: 'street_stall' },
    range: 1,
    effect: { type: 'income_multiplier', delta: 0.15 },
    reciprocal: true,
  },
  {
    id: 'nightclub_noise',
    sourceBlockId: 'nightclub',
    target: { category: 'residential' },
    range: 1,
    effect: { type: 'appeal_delta', delta: -12 },
  },
  {
    id: 'clinic_care',
    sourceBlockId: 'clinic',
    target: { category: 'residential' },
    range: 1,
    effect: { type: 'appeal_delta', delta: 6 },
  },
  {
    id: 'shrine_order',
    sourceBlockId: 'alley_shrine',
    target: { category: 'residential' },
    range: 2,
    effect: { type: 'order_delta', delta: 4 },
  },
  {
    id: 'server_heat',
    sourceBlockId: 'server_farm',
    target: { blockId: 'server_farm' },
    range: 1,
    effect: { type: 'pollution_delta', delta: 2 },
  },
];

export interface CellEffects {
  incomeMultiplier: number;
  appealDelta: number;
  orderDelta: number;
  pollutionDelta: number;
}

function emptyEffects(): CellEffects {
  return { incomeMultiplier: 1, appealDelta: 0, orderDelta: 0, pollutionDelta: 0 };
}

function applyEffect(effects: CellEffects, effect: SynergyEffect): void {
  if (effect.type === 'income_multiplier') effects.incomeMultiplier *= 1 + effect.delta;
  else if (effect.type === 'appeal_delta') effects.appealDelta += effect.delta;
  else if (effect.type === 'order_delta') effects.orderDelta += effect.delta;
  else if (effect.type === 'pollution_delta') effects.pollutionDelta += effect.delta;
}

function matches(target: SynergyTarget, block: BlockDef): boolean {
  if (target.blockId && target.blockId !== block.id) return false;
  if (target.category && target.category !== block.category) return false;
  return true;
}

function chebyshevDistanceOnFloor(a: CellCoord, b: CellCoord): number | null {
  if (a.y !== b.y) return null;
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

export function computeSynergyEffects(
  cells: ReadonlyMap<string, CellRecord>,
  blocks: Readonly<Record<string, BlockDef>>,
  rules: readonly SynergyRule[] = SYNERGY_RULES
): ReadonlyMap<string, CellEffects> {
  const result = new Map<string, CellEffects>();
  if (rules.length === 0) return result;

  const entries = Array.from(cells.entries());

  for (const [sourceKey, sourceRecord] of entries) {
    const applicableRules = rules.filter((rule) => rule.sourceBlockId === sourceRecord.blockId);
    if (applicableRules.length === 0) continue;

    const sourceCoord = parseCellKey(sourceKey);

    for (const [targetKey, targetRecord] of entries) {
      if (targetKey === sourceKey) continue;
      const targetBlock = blocks[targetRecord.blockId];
      if (!targetBlock) continue;
      const targetCoord = parseCellKey(targetKey);
      const distance = chebyshevDistanceOnFloor(sourceCoord, targetCoord);
      if (distance === null) continue;

      for (const rule of applicableRules) {
        if (distance > rule.range) continue;
        if (!matches(rule.target, targetBlock)) continue;

        const targetEffects = result.get(targetKey) ?? emptyEffects();
        applyEffect(targetEffects, rule.effect);
        result.set(targetKey, targetEffects);

        if (rule.reciprocal) {
          const sourceEffects = result.get(sourceKey) ?? emptyEffects();
          applyEffect(sourceEffects, rule.effect);
          result.set(sourceKey, sourceEffects);
        }
      }
    }
  }

  return result;
}

export function getCellEffects(effects: ReadonlyMap<string, CellEffects>, key: string): CellEffects {
  return effects.get(key) ?? emptyEffects();
}
