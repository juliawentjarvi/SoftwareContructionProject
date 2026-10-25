/**
 * Daily energy points, derived from that day's totals so that correcting or deleting an entry recalculates them.
 * Energy is separate from reward points (spent on treats and customization); starting Sudoku costs energy only.
 */

export const ENERGY_PER_MEAL = 10;
export const ENERGY_PER_STEP_INTERVAL = 5;
export const STEP_INTERVAL = 1000;
export const SUDOKU_ENERGY_COST = 5;

export interface EnergyInput {
  mealCount: number;
  /** Steps recorded for the day, or null when none were entered. */
  steps: number | null;
  /** Number of Sudoku games started that day (each costs energy once). */
  sudokuStarts: number;
  mealGoal: number;
}

export interface Energy {
  /** May be negative after Sudoku; later earnings offset it first. */
  points: number;
  /** Full bar: 10 points per planned meal. */
  target: number;
  /** Bar fill 0 to 100: empty while negative, never above full. */
  fill: number;
}

export function computeEnergy({ mealCount, steps, sudokuStarts, mealGoal }: EnergyInput): Energy {
  const stepPoints = steps === null ? 0 : Math.floor(Math.max(0, steps) / STEP_INTERVAL) * ENERGY_PER_STEP_INTERVAL;
  const points = mealCount * ENERGY_PER_MEAL + stepPoints - sudokuStarts * SUDOKU_ENERGY_COST;
  const target = Math.max(0, mealGoal) * ENERGY_PER_MEAL;
  const fill = target > 0 ? Math.min(100, Math.max(0, (points / target) * 100)) : 0;
  return { points, target, fill };
}
