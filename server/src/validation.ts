import { z } from 'zod';

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const timezoneField = z.string().trim().min(1).max(100).refine(isTimeZone, 'Use a valid IANA timezone');
// Emails are compared case-insensitively and without surrounding whitespace everywhere they are accepted.
const emailField = z.string().trim().toLowerCase().email().max(254);

export const registerSchema = z.object({
  email: emailField,
  password: z.string().min(10).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes'),
  displayName: z.string().trim().min(1).max(60),
  timezone: timezoneField.optional(),
});

export const passwordResetRequestSchema = z.object({ email: emailField });

export const passwordResetConfirmSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(10).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes'),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes'),
});

// Reminder times are local wall-clock times on the user's device, so they are independent of the profile timezone.
// How often reminders appear is the number of times (1 to 8 a day), kept in time order without duplicates.
const reminderTimesField = z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
  .min(1, 'Choose at least one reminder time')
  .max(8, 'Choose at most eight reminder times')
  .refine((times) => new Set(times).size === times.length, 'Reminder times must be different')
  .transform((times) => [...times].sort());

export const profilePatchSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  timezone: timezoneField.optional(),
  dailyMealGoal: z.number().int().min(1).optional(),
  notificationsEnabled: z.boolean().optional(),
  reminderTimes: reminderTimesField.optional(),
}).refine((value) => Object.keys(value).length > 0, 'Provide at least one profile field');

export const mealCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  mealType: z.enum(mealTypes),
  eatenAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  notes: z.string().trim().max(280).nullable().optional(),
});

export const mealPatchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  mealType: z.enum(mealTypes).optional(),
  eatenAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  notes: z.string().trim().max(280).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Provide at least one meal field');

export const mealsQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
}).refine((value) => {
  if (!value.from || !value.to) return true;
  const duration = Date.parse(value.to) - Date.parse(value.from);
  return duration >= 0 && duration <= 31 * 24 * 60 * 60 * 1000;
}, 'Date range must be ordered and no longer than 31 days');