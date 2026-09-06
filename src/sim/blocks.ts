// 블록 정의 레지스트리. three.js 비의존. §8.2 스키마.

import blocksData from '../data/blocks.json';

export type LightPref = 'NEEDS_LIGHT' | 'INDIFFERENT' | 'PREFERS_DARK';
export type BlockCategory = 'residential' | 'commerce' | 'utility' | 'access' | 'civic' | 'lightwell';

export interface BlockDef {
  id: string;
  name: string;
  tier: number;
  category: BlockCategory;
  cost: number;
  upkeep: number;
  weight: number;
  structuralCapacity: number;
  lightPref: LightPref;
  roofOnly: boolean;
  flows: { power?: number; water?: number };
  provides: { jobs?: number; income?: number; appeal?: number; housing?: number; order?: number };
  emits: { pollution?: number; noise?: number };
  visual: { base: string; facade: string; props: string[] };
  description: string;
}

export const BLOCKS: readonly BlockDef[] = blocksData as BlockDef[];

export const BLOCK_REGISTRY: Readonly<Record<string, BlockDef>> = Object.fromEntries(
  BLOCKS.map((block) => [block.id, block])
);

export function getBlock(blockId: string): BlockDef {
  const block = BLOCK_REGISTRY[blockId];
  if (!block) throw new Error(`알 수 없는 블록 id: ${blockId}`);
  return block;
}
