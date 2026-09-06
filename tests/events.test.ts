import { describe, expect, it } from 'vitest';
import { EVENTS, evaluateTrigger, findTriggeredEvent, type EventDef } from '../src/sim/events';

describe('evaluateTrigger', () => {
  const ctx = { population: 50, darkCells: 25 };
  const flags = new Set(['met_amei']);

  it('evaluates a single stat condition', () => {
    expect(evaluateTrigger({ stat: 'population', op: '>=', value: 40 }, ctx, flags)).toBe(true);
    expect(evaluateTrigger({ stat: 'population', op: '>=', value: 60 }, ctx, flags)).toBe(false);
  });

  it('missing stats default to 0', () => {
    expect(evaluateTrigger({ stat: 'nonexistent', op: '<', value: 1 }, ctx, flags)).toBe(true);
  });

  it('requires every condition in "all"', () => {
    const trigger = {
      all: [
        { stat: 'population', op: '>=' as const, value: 40 },
        { stat: 'darkCells', op: '>=' as const, value: 30 },
      ],
    };
    expect(evaluateTrigger(trigger, ctx, flags)).toBe(false);
  });

  it('requires only one condition in "any"', () => {
    const trigger = {
      any: [
        { stat: 'population', op: '>=' as const, value: 999 },
        { stat: 'darkCells', op: '>=' as const, value: 20 },
      ],
    };
    expect(evaluateTrigger(trigger, ctx, flags)).toBe(true);
  });

  it('checks flag presence/absence', () => {
    expect(evaluateTrigger({ flag: 'met_amei', set: true }, ctx, flags)).toBe(true);
    expect(evaluateTrigger({ flag: 'met_kage', set: true }, ctx, flags)).toBe(false);
    expect(evaluateTrigger({ flag: 'met_kage', set: false }, ctx, flags)).toBe(true);
  });
});

describe('findTriggeredEvent', () => {
  const events: EventDef[] = [
    {
      id: 'a',
      trigger: { stat: 'population', op: '>=', value: 10 },
      once: true,
      title: 'A',
      speaker: 'x',
      body: '',
      choices: [],
    },
    {
      id: 'b',
      trigger: { stat: 'population', op: '>=', value: 10 },
      once: false,
      title: 'B',
      speaker: 'x',
      body: '',
      choices: [],
    },
  ];

  it('returns the first matching event', () => {
    const found = findTriggeredEvent(events, { population: 20 }, new Set(), new Set());
    expect(found?.id).toBe('a');
  });

  it('skips a once-only event that already fired', () => {
    const found = findTriggeredEvent(events, { population: 20 }, new Set(), new Set(['a']));
    expect(found?.id).toBe('b');
  });

  it('returns null when nothing matches', () => {
    const found = findTriggeredEvent(events, { population: 0 }, new Set(), new Set());
    expect(found).toBeNull();
  });
});

describe('EVENTS content', () => {
  it('loads a non-trivial roster with unique ids', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
  });

  it('every event has at least one choice', () => {
    for (const event of EVENTS) {
      expect(event.choices.length).toBeGreaterThan(0);
    }
  });
});
