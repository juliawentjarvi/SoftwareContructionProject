import { describe, expect, it } from 'vitest';
import { loginSchema, mealCreateSchema, profilePatchSchema, registerSchema } from '../src/validation.js';

describe('profile and meal validation', () => {
  it('accepts a reminder toggle and valid 24-hour reminder times', () => {
    expect(profilePatchSchema.safeParse({
      notificationsEnabled: true,
      reminderTimes: ['08:15', '12:30', '19:00'],
    }).success).toBe(true);
  });

  it('accepts any positive whole-number meal target and rejects zero, negatives and fractions', () => {
    for (const dailyMealGoal of [1, 8, 9, 12, 100]) {
      expect(profilePatchSchema.safeParse({ dailyMealGoal }).success).toBe(true);
    }
    for (const dailyMealGoal of [0, -1, 2.5]) {
      expect(profilePatchSchema.safeParse({ dailyMealGoal }).success).toBe(false);
    }
  });

  it('normalizes registration and login emails for case and surrounding whitespace', () => {
    const password = 'a-long-enough-password';
    expect(registerSchema.parse({ email: '  Bear@Example.TEST ', password, displayName: 'Bear' }).email).toBe('bear@example.test');
    expect(loginSchema.parse({ email: ' BEAR@example.test', password }).email).toBe('bear@example.test');
  });

  it('rejects an unknown registration timezone', () => {
    const base = { email: 'a@example.test', password: 'a-long-enough-password', displayName: 'A' };
    expect(registerSchema.safeParse({ ...base, timezone: 'Europe/Stockholm' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, timezone: 'Mars/Olympus' }).success).toBe(false);
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