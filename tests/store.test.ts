import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../src/sim/store';
import type { EventDef } from '../src/sim/events';

const dummyEvent: EventDef = {
  id: 'dummy',
  trigger: { stat: 'x', op: '>=', value: 0 },
  once: true,
  title: '더미',
  speaker: 'lao_chen',
  body: '',
  choices: [
    { text: '유료 선택', cost: { credits: 100 }, effects: { appeal: 5 } },
    { text: '무료 선택', effects: { order: -2 } },
  ],
};

describe('resolveEvent', () => {
  beforeEach(() => {
    useGameStore.setState({ credits: -58, pendingEvent: dummyEvent, modifiers: { appeal: 0, order: 0 } });
  });

  it('blocks a paid choice when credits are insufficient', () => {
    useGameStore.getState().resolveEvent(0);
    // 거부됐으므로 pendingEvent가 그대로 남아 있어야 한다.
    expect(useGameStore.getState().pendingEvent?.id).toBe('dummy');
  });

  it('allows a free choice even while in debt', () => {
    useGameStore.getState().resolveEvent(1);
    expect(useGameStore.getState().pendingEvent).toBeNull();
    expect(useGameStore.getState().modifiers.order).toBe(-2);
  });
});
