import { describe, expect, it } from 'vitest';
import { mealCreateSchema, profilePatchSchema } from '../src/validation.js';

describe('profile and meal validation', () => {
  it('accepts a reminder toggle and valid 24-hour reminder times', () => {
    expect(profilePatchSchema.safeParse({
      notificationsEnabled: true,
      reminderTimes: ['08:15', '12:30', '19:00'],
    }).success).toBe(true);
  });

  it('rejects malformed reminder times', () => {
    expect(profilePatchSchema.safeParse({ reminderTimes: ['25:90'] }).success).toBe(false);
  });

  it('requires a meal name and stores its selected meal type and timestamp', () => {
    const valid = mealCreateSchema.safeParse({
      name: 'Vegetable soup',
      mealType: 'lunch',
      eatenAt: '2026-10-20T12:00:00.000Z',
      notes: 'Had a break outside',
    });
    expect(valid.success).toBe(true);
    expect(mealCreateSchema.safeParse({ mealType: 'lunch', eatenAt: '2026-10-20T12:00:00.000Z' }).success).toBe(false);
  });
});