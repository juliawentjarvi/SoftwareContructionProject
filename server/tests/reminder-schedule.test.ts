import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MAX_REMINDERS, defaultReminderTimes, reconcileReminderTimes, reminderCountFor } from '../src/reminder-schedule.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

describe('default reminder times', () => {
  it('follows the meal rhythm for small targets', () => {
    expect(defaultReminderTimes(1)).toEqual(['12:00']);
    expect(defaultReminderTimes(2)).toEqual(['08:00', '18:00']);
    expect(defaultReminderTimes(3)).toEqual(['08:00', '12:30', '18:30']);
    expect(defaultReminderTimes(4)).toEqual(['08:00', '12:30', '15:30', '18:30']);
    expect(defaultReminderTimes(5)).toEqual(['08:00', '10:30', '12:30', '15:30', '18:30']);
  });

  it.each(Array.from({ length: 12 }, (_, i) => i + 1))('gives exactly %i distinct, ordered, valid times', (n) => {
    const times = defaultReminderTimes(n);
    expect(times).toHaveLength(n);
    expect(new Set(times).size).toBe(n);
    expect([...times].sort()).toEqual(times);
    expect(times.every(isTime)).toBe(true);
  });

  it('spreads six or more evenly across the waking day', () => {
    const times = defaultReminderTimes(6);
    expect(times[0]).toBe('07:30');
    expect(times.at(-1)).toBe('21:00');
  });

  it('caps the number of reminders at twelve, however large the target', () => {
    expect(MAX_REMINDERS).toBe(12);
    expect(reminderCountFor(1)).toBe(1);
    expect(reminderCountFor(12)).toBe(12);
    expect(reminderCountFor(312)).toBe(12);
    expect(defaultReminderTimes(312)).toHaveLength(12);
  });
});

describe('reconcileReminderTimes', () => {
  it('regenerates the default when the schedule was never edited', () => {
    expect(reconcileReminderTimes(defaultReminderTimes(3), 3, 5)).toEqual(defaultReminderTimes(5));
    expect(reconcileReminderTimes(defaultReminderTimes(3), 3, 2)).toEqual(defaultReminderTimes(2));
  });

  it('keeps edited times when growing and adds distinct extra times', () => {
    const edited = ['07:00', '13:00', '19:30'];
    const grown = reconcileReminderTimes(edited, 3, 5);
    expect(grown).toHaveLength(5);
    expect(grown).toEqual(expect.arrayContaining(edited));
    expect(new Set(grown).size).toBe(5);
    expect([...grown].sort()).toEqual(grown);
  });

  it('drops the latest times when shrinking an edited schedule', () => {
    expect(reconcileReminderTimes(['07:00', '13:00', '19:30'], 3, 2)).toEqual(['07:00', '13:00']);
  });

  it('leaves a schedule that already has the right length alone', () => {
    const edited = ['07:00', '13:00', '19:30'];
    expect(reconcileReminderTimes(edited, 3, 3)).toEqual(edited);
    expect(reconcileReminderTimes(edited, 3, 30)).toHaveLength(12);
  });
});

describe.skipIf(!process.env.TEST_MONGODB_URI)('profile reminders follow the meal target', () => {
  const createdUserIds: Types.ObjectId[] = [];
  const app = createApp({ jwtSecret: 'test-secret-at-least-32-characters-long', jwtExpiresIn: '7d', allowedOrigins: [] });

  beforeAll(async () => {
    configureTestMongoDns();
    await mongoose.connect(getTestMongoUri());
  });
  afterEach(async () => {
    await cleanTestAccounts(createdUserIds.splice(0));
  });
  afterAll(disconnectTestDatabase);

  async function signUp(label: string) {
    const response = await request(app).post('/api/auth/register').send(createTestIdentity(label));
    expect(response.status).toBe(201);
    createdUserIds.push(new Types.ObjectId(response.body.user.id));
    return { auth: `Bearer ${response.body.accessToken as string}`, user: response.body.user };
  }

  it('gives new accounts a three-meal default schedule', async () => {
    const { user } = await signUp('rs-new');
    expect(user.dailyMealGoal).toBe(3);
    expect(user.reminderTimes).toEqual(['08:00', '12:30', '18:30']);
  });

  it('adds and removes reminders when the meal target changes, and caps them at twelve', async () => {
    const { auth } = await signUp('rs-goal');
    const five = await request(app).patch('/api/profile').set('Authorization', auth).send({ dailyMealGoal: 5 });
    expect(five.body.user.reminderTimes).toEqual(defaultReminderTimes(5));

    const two = await request(app).patch('/api/profile').set('Authorization', auth).send({ dailyMealGoal: 2 });
    expect(two.body.user.reminderTimes).toEqual(defaultReminderTimes(2));

    const many = await request(app).patch('/api/profile').set('Authorization', auth).send({ dailyMealGoal: 40 });
    expect(many.body.user.dailyMealGoal).toBe(40);
    expect(many.body.user.reminderTimes).toHaveLength(12);
  });

  it('accepts edited times only when their number matches the meal target', async () => {
    const { auth } = await signUp('rs-edit');
    const ok = await request(app).patch('/api/profile').set('Authorization', auth).send({ reminderTimes: ['09:15', '14:00', '20:00'] });
    expect(ok.status).toBe(200);
    expect(ok.body.user.reminderTimes).toEqual(['09:15', '14:00', '20:00']);

    const tooFew = await request(app).patch('/api/profile').set('Authorization', auth).send({ reminderTimes: ['09:15', '14:00'] });
    expect(tooFew.status).toBe(400);
    expect(tooFew.body.error.code).toBe('INVALID_REQUEST');

    const both = await request(app).patch('/api/profile').set('Authorization', auth).send({ dailyMealGoal: 2, reminderTimes: ['09:15', '14:00'] });
    expect(both.status).toBe(200);
    expect(both.body.user).toMatchObject({ dailyMealGoal: 2, reminderTimes: ['09:15', '14:00'] });
  });

  it('keeps edited times when the target grows', async () => {
    const { auth } = await signUp('rs-keep');
    await request(app).patch('/api/profile').set('Authorization', auth).send({ reminderTimes: ['07:00', '13:00', '19:30'] });
    const grown = await request(app).patch('/api/profile').set('Authorization', auth).send({ dailyMealGoal: 4 });
    expect(grown.body.user.reminderTimes).toHaveLength(4);
    expect(grown.body.user.reminderTimes).toEqual(expect.arrayContaining(['07:00', '13:00', '19:30']));
  });
});
