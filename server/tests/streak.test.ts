import { describe, expect, it } from 'vitest';
import { summarizeDailyCounts } from '../src/progress.js';

const days = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe('streak with a step target (a day qualifies when meals AND steps are met)', () => {
  it('counts steps only when a step target is set; without one, meals alone decide', () => {
    const meals = days({ '2026-10-23': 3, '2026-10-24': 3, '2026-10-25': 3 });
    const noTarget = summarizeDailyCounts(meals, '2026-10-25', 3, { stepTarget: null });
    expect(noTarget.currentStreakDays).toBe(3);
  });

  it('does not qualify a day whose steps are missing or below the target', () => {
    const meals = days({ '2026-10-23': 3, '2026-10-24': 3, '2026-10-25': 3 });
    const steps = new Map([['2026-10-23', 9000], ['2026-10-24', 3000]]); // 25th has no steps at all
    const summary = summarizeDailyCounts(meals, '2026-10-25', 3, { stepTarget: 8000, stepsByDay: steps });
    expect(summary.currentStreakDays).toBe(0); // today is missing steps, yesterday below target
    expect(summary.lastSevenDays.filter((d) => d.date >= '2026-10-23').map((d) => d.qualifies)).toEqual([true, false, false]);
  });

  it('counts consecutive qualifying days and lets today join the streak when it qualifies', () => {
    const meals = days({ '2026-10-23': 3, '2026-10-24': 3, '2026-10-25': 3 });
    const steps = new Map([['2026-10-23', 8000], ['2026-10-24', 12000], ['2026-10-25', 8500]]);
    expect(summarizeDailyCounts(meals, '2026-10-25', 3, { stepTarget: 8000, stepsByDay: steps }).currentStreakDays).toBe(3);
  });

  it('keeps yesterday\'s streak alive until today ends, as before', () => {
    const meals = days({ '2026-10-23': 3, '2026-10-24': 3 });
    const steps = new Map([['2026-10-23', 8000], ['2026-10-24', 8000]]);
    expect(summarizeDailyCounts(meals, '2026-10-25', 3, { stepTarget: 8000, stepsByDay: steps }).currentStreakDays).toBe(2);
  });

  it('requires enough meals even when steps are plentiful', () => {
    const meals = days({ '2026-10-25': 1 });
    const steps = new Map([['2026-10-25', 30000]]);
    expect(summarizeDailyCounts(meals, '2026-10-25', 3, { stepTarget: 8000, stepsByDay: steps }).currentStreakDays).toBe(0);
  });
});

describe('bear health (playful, not medical)', () => {
  const start = { accountStart: '2026-10-01' };

  it('is good by default and after a single missed day', () => {
    expect(summarizeDailyCounts(days({ '2026-10-23': 3 }), '2026-10-25', 3, start).bearHealth).toBe('good');
    expect(summarizeDailyCounts(days({ '2026-10-23': 3, '2026-10-24': 1 }), '2026-10-25', 3, start).bearHealth).toBe('good');
  });

  it('drops to low after two consecutive completed days below the meal target', () => {
    const summary = summarizeDailyCounts(days({ '2026-10-23': 2, '2026-10-24': 0 }), '2026-10-25', 3, start);
    expect(summary.bearHealth).toBe('low');
  });

  it('recovers as soon as today\'s meal target is met', () => {
    const summary = summarizeDailyCounts(days({ '2026-10-23': 0, '2026-10-24': 0, '2026-10-25': 3 }), '2026-10-25', 3, start);
    expect(summary.bearHealth).toBe('good');
  });

  it('does not count days before the account existed', () => {
    const fresh = summarizeDailyCounts(new Map(), '2026-10-25', 3, { accountStart: '2026-10-25' });
    expect(fresh.bearHealth).toBe('good');
    const second = summarizeDailyCounts(new Map(), '2026-10-25', 3, { accountStart: '2026-10-24' });
    expect(second.bearHealth).toBe('good'); // only one completed day exists
    const third = summarizeDailyCounts(new Map(), '2026-10-25', 3, { accountStart: '2026-10-23' });
    expect(third.bearHealth).toBe('low');
  });

  it('ignores steps entirely: health follows the meal target only', () => {
    const steps = new Map([['2026-10-23', 20000], ['2026-10-24', 20000]]);
    const summary = summarizeDailyCounts(days({ '2026-10-23': 0, '2026-10-24': 0 }), '2026-10-25', 3, { ...start, stepsByDay: steps, stepTarget: 8000 });
    expect(summary.bearHealth).toBe('low');
  });
});
