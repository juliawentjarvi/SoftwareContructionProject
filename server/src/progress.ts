import { computeEnergy, type Energy } from './energy.js';

export interface DayExtras {
  /** Steps per local day. A day with no step entry is absent from the map (missing, not zero). */
  stepsByDay?: Map<string, number>;
  stepTarget?: number | null;
  /** Sudoku games started per local day (each costs energy once). */
  sudokuStartsByDay?: Map<string, number>;
  /** First local day of the account; earlier days can never count as missed (a new account is not "unwell"). */
  accountStart?: string;
}

export interface ProgressSummary {
  date: string;
  dailyMealGoal: number;
  mealCount: number;
  goalMet: boolean;
  currentStreakDays: number;
  steps: number | null;
  stepTarget: number | null;
  stepsMet: boolean;
  energy: Energy;
  /** Playful mood of the bear: low after two completed days below the meal target, good again once today's target is met. Not medical. */
  bearHealth: 'good' | 'low';
  lastSevenDays: { date: string; mealCount: number; goalMet: boolean; qualifies: boolean; steps: number | null; energyPoints: number }[];
}

export function dateKeyAt(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days));
  return shifted.toISOString().slice(0, 10);
}

export function summarizeProgress(
  meals: Date[],
  now: Date,
  timeZone: string,
  dailyMealGoal: number,
): ProgressSummary {
  const counts = new Map<string, number>();
  for (const meal of meals) {
    const key = dateKeyAt(meal, timeZone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return summarizeDailyCounts(counts, dateKeyAt(now, timeZone), dailyMealGoal);
}

function bearHealthFor(counts: Map<string, number>, today: string, goal: number, accountStart: string | undefined): 'good' | 'low' {
  if ((counts.get(today) ?? 0) >= goal) return 'good';
  const missed = (date: string) => (accountStart === undefined || date >= accountStart) && (counts.get(date) ?? 0) < goal;
  const yesterday = shiftDateKey(today, -1);
  const dayBefore = shiftDateKey(today, -2);
  return accountStart !== undefined && missed(yesterday) && missed(dayBefore) ? 'low' : 'good';
}

export function summarizeDailyCounts(
  counts: Map<string, number>,
  today: string,
  dailyMealGoal: number,
  extras: DayExtras = {},
): ProgressSummary {
  const stepsByDay = extras.stepsByDay ?? new Map<string, number>();
  const stepTarget = extras.stepTarget ?? null;
  const energyFor = (date: string, count: number) => computeEnergy({
    mealCount: count,
    steps: stepsByDay.get(date) ?? null,
    sudokuStarts: extras.sudokuStartsByDay?.get(date) ?? 0,
    mealGoal: dailyMealGoal,
  });
  // A streak day needs the meal target and, when a step target is set, the step target too (missing steps do not qualify).
  const qualifies = (date: string) =>
    (counts.get(date) ?? 0) >= dailyMealGoal && (stepTarget === null || (stepsByDay.get(date) ?? -1) >= stepTarget);
  const mealCount = counts.get(today) ?? 0;
  let streakStart = qualifies(today) ? today : shiftDateKey(today, -1);
  let currentStreakDays = 0;
  while (qualifies(streakStart)) {
    currentStreakDays += 1;
    streakStart = shiftDateKey(streakStart, -1);
  }

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDateKey(today, index - 6);
    const count = counts.get(date) ?? 0;
    return { date, mealCount: count, goalMet: count >= dailyMealGoal, qualifies: qualifies(date), steps: stepsByDay.get(date) ?? null, energyPoints: energyFor(date, count).points };
  });

  return {
    date: today,
    dailyMealGoal,
    mealCount,
    goalMet: mealCount >= dailyMealGoal,
    currentStreakDays,
    steps: stepsByDay.get(today) ?? null,
    stepTarget,
    stepsMet: stepTarget !== null && (stepsByDay.get(today) ?? -1) >= stepTarget,
    energy: energyFor(today, mealCount),
    bearHealth: bearHealthFor(counts, today, dailyMealGoal, extras.accountStart),
    lastSevenDays,
  };
}