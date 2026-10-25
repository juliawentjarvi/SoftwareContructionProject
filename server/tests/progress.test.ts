import { describe, expect, it } from 'vitest';
import { dateKeyAt, summarizeDailyCounts, summarizeProgress } from '../src/progress.js';

describe('meal progress', () => {
  it('groups meals by the profile timezone across UTC day boundaries', () => {
    const summary = summarizeProgress(
      [new Date('2026-10-08T23:30:00.000Z'), new Date('2026-10-09T05:30:00.000Z')],
      new Date('2026-10-09T06:00:00.000Z'),
      'America/Los_Angeles',
      2,
    );

    expect(summary.date).toBe('2026-10-08');
    expect(summary.mealCount).toBe(2);
    expect(summary.goalMet).toBe(true);
  });

  it('continues a streak from yesterday until today reaches its goal', () => {
    const summary = summarizeDailyCounts(new Map([
      ['2026-10-06', 3],
      ['2026-10-07', 3],
      ['2026-10-08', 3],
      ['2026-10-09', 1],
    ]), '2026-10-09', 3);

    expect(summary.currentStreakDays).toBe(3);
    expect(summary.goalMet).toBe(false);
    expect(summary.lastSevenDays.at(-1)).toMatchObject({ date: '2026-10-09', mealCount: 1, goalMet: false, steps: null, energyPoints: 10 });
  });

  it('returns zero streak after a missed day', () => {
    const summary = summarizeDailyCounts(new Map([['2026-10-07', 3]]), '2026-10-09', 3);
    expect(summary.currentStreakDays).toBe(0);
  });

  it('formats local calendar dates from an IANA timezone', () => {
    expect(dateKeyAt(new Date('2026-01-01T01:00:00.000Z'), 'America/Los_Angeles')).toBe('2025-12-31');
  });
});