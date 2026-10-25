import { describe, expect, it } from 'vitest';
import { ENERGY_PER_MEAL, ENERGY_PER_STEP_INTERVAL, SUDOKU_ENERGY_COST, computeEnergy } from '../src/energy.js';
import { summarizeDailyCounts } from '../src/progress.js';

describe('energy points', () => {
  it('awards 10 per meal, 5 per full 1,000 steps and charges 5 per Sudoku start', () => {
    expect(ENERGY_PER_MEAL).toBe(10);
    expect(ENERGY_PER_STEP_INTERVAL).toBe(5);
    expect(SUDOKU_ENERGY_COST).toBe(5);
    expect(computeEnergy({ mealCount: 3, steps: null, sudokuStarts: 0, mealGoal: 5 }).points).toBe(30);
    expect(computeEnergy({ mealCount: 0, steps: 3000, sudokuStarts: 0, mealGoal: 3 }).points).toBe(15);
    expect(computeEnergy({ mealCount: 2, steps: 2500, sudokuStarts: 1, mealGoal: 3 }).points).toBe(25); // 20 + 10 - 5
  });

  it('gives nothing for partial 1,000-step intervals', () => {
    expect(computeEnergy({ mealCount: 0, steps: 999, sudokuStarts: 0, mealGoal: 3 }).points).toBe(0);
    expect(computeEnergy({ mealCount: 0, steps: 1000, sudokuStarts: 0, mealGoal: 3 }).points).toBe(5);
    expect(computeEnergy({ mealCount: 0, steps: 1999, sudokuStarts: 0, mealGoal: 3 }).points).toBe(5);
  });

  it('sets the full target to 10 points per planned meal', () => {
    expect(computeEnergy({ mealCount: 0, steps: null, sudokuStarts: 0, mealGoal: 5 }).target).toBe(50);
    expect(computeEnergy({ mealCount: 0, steps: null, sudokuStarts: 0, mealGoal: 12 }).target).toBe(120);
  });

  it('fills the bar in proportion, never above full, and shows empty while negative', () => {
    expect(computeEnergy({ mealCount: 5, steps: null, sudokuStarts: 0, mealGoal: 5 }).fill).toBe(100);
    expect(computeEnergy({ mealCount: 5, steps: 10000, sudokuStarts: 0, mealGoal: 5 }).fill).toBe(100); // 100 points, clamped
    expect(computeEnergy({ mealCount: 5, steps: null, sudokuStarts: 1, mealGoal: 5 }).fill).toBe(90); // spec example: full -> 90%
    expect(computeEnergy({ mealCount: 0, steps: null, sudokuStarts: 2, mealGoal: 5 })).toMatchObject({ points: -10, fill: 0 });
  });

  it('lets later earnings offset a negative balance first', () => {
    const before = computeEnergy({ mealCount: 0, steps: null, sudokuStarts: 2, mealGoal: 3 });
    const after = computeEnergy({ mealCount: 1, steps: null, sudokuStarts: 2, mealGoal: 3 });
    expect(before.points).toBe(-10);
    expect(after.points).toBe(0);
    expect(after.fill).toBe(0);
  });

  it('recalculates when entries are corrected or removed, because it is derived from the day totals', () => {
    expect(computeEnergy({ mealCount: 4, steps: 5000, sudokuStarts: 0, mealGoal: 4 }).points).toBe(65);
    expect(computeEnergy({ mealCount: 3, steps: 5000, sudokuStarts: 0, mealGoal: 4 }).points).toBe(55); // a meal deleted
    expect(computeEnergy({ mealCount: 3, steps: 2000, sudokuStarts: 0, mealGoal: 4 }).points).toBe(40); // steps corrected down
  });

  it('copes with an invalid target', () => {
    expect(computeEnergy({ mealCount: 1, steps: null, sudokuStarts: 0, mealGoal: 0 }).fill).toBe(0);
  });
});

describe('daily progress with steps and energy', () => {
  const day = (date: string) => date;

  it('keeps missing step information distinct from zero, and from a met target', () => {
    const none = summarizeDailyCounts(new Map([[day('2026-10-25'), 2]]), '2026-10-25', 3, { stepsByDay: new Map(), stepTarget: 8000 });
    expect(none.steps).toBeNull();
    expect(none.stepsMet).toBe(false);

    const zero = summarizeDailyCounts(new Map(), '2026-10-25', 3, { stepsByDay: new Map([['2026-10-25', 0]]), stepTarget: 8000 });
    expect(zero.steps).toBe(0);
    expect(zero.stepsMet).toBe(false);

    const met = summarizeDailyCounts(new Map(), '2026-10-25', 3, { stepsByDay: new Map([['2026-10-25', 8000]]), stepTarget: 8000 });
    expect(met.stepsMet).toBe(true);
  });

  it('never calls the step target met when no target is set', () => {
    const summary = summarizeDailyCounts(new Map(), '2026-10-25', 3, { stepsByDay: new Map([['2026-10-25', 20000]]), stepTarget: null });
    expect(summary.stepsMet).toBe(false);
    expect(summary.stepTarget).toBeNull();
  });

  it('reports energy for today and for each of the last seven days from that day alone (daily reset)', () => {
    const summary = summarizeDailyCounts(
      new Map([['2026-10-24', 3], ['2026-10-25', 1]]),
      '2026-10-25',
      3,
      { stepsByDay: new Map([['2026-10-24', 4000]]), stepTarget: null },
    );
    expect(summary.energy).toEqual({ points: 10, target: 30, fill: (10 / 30) * 100 });
    const yesterday = summary.lastSevenDays.find((entry) => entry.date === '2026-10-24');
    expect(yesterday).toMatchObject({ steps: 4000, energyPoints: 50 });
  });

  it('still computes meal streaks exactly as before', () => {
    const summary = summarizeDailyCounts(new Map([['2026-10-23', 3], ['2026-10-24', 3]]), '2026-10-25', 3);
    expect(summary.currentStreakDays).toBe(2);
  });
});
