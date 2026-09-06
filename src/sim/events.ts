// 스토리 이벤트 엔진: 조건 DSL + 선택지 + 영구 플래그 [§6.3, §8.3]. three.js 비의존.
// 조건은 구조/경제 지표에서 나온다 — 랜덤으로 뜨지 않는다.

import eventsData from '../data/events.json';

export type CompareOp = '>=' | '<=' | '>' | '<' | '==' | '!=';

export interface StatCondition {
  stat: string;
  op: CompareOp;
  value: number;
}

export interface FlagCondition {
  flag: string;
  set: boolean; // true = 플래그가 있어야 함, false = 없어야 함
}

export type TriggerNode =
  | { all: TriggerNode[] }
  | { any: TriggerNode[] }
  | StatCondition
  | FlagCondition;

function isStatCondition(node: TriggerNode): node is StatCondition {
  return 'stat' in node;
}

function isFlagCondition(node: TriggerNode): node is FlagCondition {
  return 'flag' in node;
}

export function evaluateTrigger(
  node: TriggerNode,
  ctx: Readonly<Record<string, number>>,
  flags: ReadonlySet<string>
): boolean {
  if ('all' in node) return node.all.every((n) => evaluateTrigger(n, ctx, flags));
  if ('any' in node) return node.any.some((n) => evaluateTrigger(n, ctx, flags));
  if (isFlagCondition(node)) return flags.has(node.flag) === node.set;
  if (isStatCondition(node)) {
    const actual = ctx[node.stat] ?? 0;
    switch (node.op) {
      case '>=':
        return actual >= node.value;
      case '<=':
        return actual <= node.value;
      case '>':
        return actual > node.value;
      case '<':
        return actual < node.value;
      case '==':
        return actual === node.value;
      case '!=':
        return actual !== node.value;
    }
  }
  return false;
}

export interface EventChoiceEffects {
  appeal?: number;
  order?: number;
  credits?: number;
}

export interface EventChoice {
  text: string;
  cost?: { credits?: number };
  effects?: EventChoiceEffects;
  setFlag?: string;
}

export interface EventDef {
  id: string;
  trigger: TriggerNode;
  once: boolean;
  title: string;
  speaker: string;
  body: string;
  choices: EventChoice[];
}

export const EVENTS: readonly EventDef[] = eventsData as EventDef[];

// 등록 순서대로 검사해 처음 조건이 맞는 이벤트 하나만 반환한다
// (한 틱에 여러 이벤트가 동시에 쏟아지지 않게).
export function findTriggeredEvent(
  events: readonly EventDef[],
  ctx: Readonly<Record<string, number>>,
  flags: ReadonlySet<string>,
  firedOnce: ReadonlySet<string>
): EventDef | null {
  for (const event of events) {
    if (event.once && firedOnce.has(event.id)) continue;
    if (evaluateTrigger(event.trigger, ctx, flags)) return event;
  }
  return null;
}
