export interface ProgressSummary {
  date: string;
  dailyMealGoal: number;
  mealCount: number;
  goalMet: boolean;
  currentStreakDays: number;
  lastSevenDays: { date: string; mealCount: number; goalMet: boolean }[];
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

export function summarizeDailyCounts(
  counts: Map<string, number>,
  today: string,
  dailyMealGoal: number,
): ProgressSummary {
  const mealCount = counts.get(today) ?? 0;
  let streakStart = mealCount >= dailyMealGoal ? today : shiftDateKey(today, -1);
  let currentStreakDays = 0;
  while ((counts.get(streakStart) ?? 0) >= dailyMealGoal) {
    currentStreakDays += 1;
    streakStart = shiftDateKey(streakStart, -1);
  }

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDateKey(today, index - 6);
    const count = counts.get(date) ?? 0;
    return { date, mealCount: count, goalMet: count >= dailyMealGoal };
  });

  return {
    date: today,
    dailyMealGoal,
    mealCount,
    goalMet: mealCount >= dailyMealGoal,
    currentStreakDays,
    lastSevenDays,
  };
}