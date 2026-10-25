import { z } from 'zod';
import { CATALOG } from './rewards.js';

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
// One reminder per planned meal, up to 12 a day (see reminder-schedule.ts), kept in time order without duplicates.
const reminderTimesField = z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
  .min(1, 'Choose at least one reminder time')
  .max(12, 'Choose at most twelve reminder times')
  .refine((times) => new Set(times).size === times.length, 'Reminder times must be different')
  .transform((times) => [...times].sort());

export const profilePatchSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  timezone: timezoneField.optional(),
  dailyMealGoal: z.number().int().min(1).optional(),
  stepTarget: z.number().int().min(1).max(1_000_000).nullable().optional(),
  selectedTheme: z.string().min(1).max(40).nullable().optional(),
  selectedAccessory: z.string().min(1).max(40).nullable().optional(),
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

const stepCount = z.number().int().min(0).max(1_000_000);

export const activityCreateSchema = z.object({
  type: z.string().trim().min(1).max(60),
  occurredAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  stepCount: stepCount.optional(),
  notes: z.string().trim().max(280).nullable().optional(),
});

export const activityPatchSchema = z.object({
  type: z.string().trim().min(1).max(60).optional(),
  occurredAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  stepCount: stepCount.nullable().optional(),
  notes: z.string().trim().max(280).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Provide at least one activity field');

export const sudokuStartSchema = z.object({ gameId: z.string().uuid() });

export const unlockSchema = z.object({
  itemId: z.string().refine((id) => CATALOG.some((item) => item.id === id), 'Unknown item'),
  purchaseId: z.string().uuid().optional(),
});

// A profile picture is a small square image sent as a data URL (the app shrinks it to a few tens of kilobytes).
export const MAX_PICTURE_BYTES = 120_000;
const MAGIC: Record<string, (bytes: Buffer) => boolean> = {
  png: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpeg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: (b) => b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

export const profilePictureSchema = z.object({
  image: z.string().max(Math.ceil(MAX_PICTURE_BYTES * 1.4)).superRefine((value, ctx) => {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) { ctx.addIssue({ code: 'custom', message: 'Send a PNG, JPEG or WebP image as a base64 data URL' }); return; }
    const bytes = Buffer.from(match[2]!, 'base64');
    if (bytes.length > MAX_PICTURE_BYTES) ctx.addIssue({ code: 'custom', message: 'The image is too large' });
    else if (!MAGIC[match[1]!]!(bytes)) ctx.addIssue({ code: 'custom', message: 'The file is not a valid image of that type' });
  }),
});
