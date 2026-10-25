/**
 * Reminder schedule rules: one reminder per planned meal (up to MAX_REMINDERS), at times that follow a typical day.
 * Times are local wall-clock "HH:mm" values on the user's device, independent of the profile timezone.
 */

export const MAX_REMINDERS = 12;

const RHYTHM: Record<number, string[]> = {
  1: ['12:00'],
  2: ['08:00', '18:00'],
  3: ['08:00', '12:30', '18:30'],
  4: ['08:00', '12:30', '15:30', '18:30'],
  5: ['08:00', '10:30', '12:30', '15:30', '18:30'],
};
const DAY_START = 7 * 60 + 30; // 07:30
const DAY_END = 21 * 60; // 21:00

export function reminderCountFor(dailyMealGoal: number): number {
  return Math.max(1, Math.min(MAX_REMINDERS, Math.floor(dailyMealGoal)));
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** The default times for `count` meals (clamped to 1..MAX_REMINDERS). */
export function defaultReminderTimes(count: number): string[] {
  const n = reminderCountFor(count);
  const preset = RHYTHM[n];
  if (preset) return [...preset];
  const step = (DAY_END - DAY_START) / (n - 1);
  return Array.from({ length: n }, (_, i) => toTime(Math.round((DAY_START + step * i) / 5) * 5));
}

/** Nearest-free-time search used when a schedule has to grow: picks the rhythm time farthest from the existing ones. */
function nextTime(existing: Set<string>, rhythm: string[]): string {
  const taken = [...existing].map(toMinutes);
  const distance = (minutes: number) => (taken.length ? Math.min(...taken.map((t) => Math.abs(t - minutes))) : 24 * 60);
  const free = rhythm.filter((time) => !existing.has(time));
  if (free.length > 0) return free.reduce((best, time) => (distance(toMinutes(time)) > distance(toMinutes(best)) ? time : best));
  for (let minutes = DAY_START; minutes < 24 * 60; minutes += 15) if (!existing.has(toTime(minutes))) return toTime(minutes);
  for (let minutes = 0; minutes < DAY_START; minutes += 15) if (!existing.has(toTime(minutes))) return toTime(minutes);
  throw new Error('No free reminder time');
}

/**
 * Bring a stored schedule in line with a changed meal target.
 * - Untouched defaults are regenerated for the new target.
 * - Otherwise edited times are kept: growing adds well-spread rhythm times, shrinking drops the latest times.
 */
export function reconcileReminderTimes(current: string[], oldGoal: number, newGoal: number): string[] {
  const oldCount = reminderCountFor(oldGoal);
  const newCount = reminderCountFor(newGoal);
  const sorted = [...current].sort();
  if (sorted.join() === defaultReminderTimes(oldCount).join()) return defaultReminderTimes(newCount);
  if (sorted.length === newCount) return sorted;
  if (sorted.length > newCount) return sorted.slice(0, newCount);

  const rhythm = defaultReminderTimes(newCount);
  const result = new Set(sorted);
  while (result.size < newCount) result.add(nextTime(result, rhythm));
  return [...result].sort();
}
