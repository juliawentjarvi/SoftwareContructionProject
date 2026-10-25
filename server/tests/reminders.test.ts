import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { profilePatchSchema } from '../src/validation.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

describe('reminder preference validation', () => {
  it('accepts 1 to 12 distinct 24-hour times and returns them in time order', () => {
    const parsed = profilePatchSchema.parse({ reminderTimes: ['19:00', '08:15', '12:30'] });
    expect(parsed.reminderTimes).toEqual(['08:15', '12:30', '19:00']);
    expect(profilePatchSchema.safeParse({ reminderTimes: ['07:00'] }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ reminderTimes: ['00:00', '01:00', '02:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '19:00', '20:00', '21:00'] }).success).toBe(true);
  });

  it.each([
    ['an out-of-range hour', ['24:00']],
    ['an out-of-range minute', ['12:60']],
    ['a time without a leading zero', ['9:00']],
    ['a non-time', ['noon']],
    ['no times at all', []],
    ['more than twelve times', ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00']],
    ['the same time twice', ['09:00', '09:00']],
  ])('rejects %s', (_label, reminderTimes) => {
    expect(profilePatchSchema.safeParse({ reminderTimes }).success).toBe(false);
  });

  it('lets reminders be switched off or on without sending times, and rejects non-boolean states', () => {
    expect(profilePatchSchema.parse({ notificationsEnabled: false })).toEqual({ notificationsEnabled: false });
    expect(profilePatchSchema.parse({ notificationsEnabled: true })).toEqual({ notificationsEnabled: true });
    expect(profilePatchSchema.safeParse({ notificationsEnabled: 'yes' }).success).toBe(false);
  });

  it('treats a timezone change as independent of the reminder times', () => {
    const parsed = profilePatchSchema.parse({ timezone: 'Europe/Stockholm' });
    expect(parsed).toEqual({ timezone: 'Europe/Stockholm' });
    expect('reminderTimes' in parsed).toBe(false);
  });
});

describe.skipIf(!process.env.TEST_MONGODB_URI)('reminder preferences are stored per account', () => {
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
    return `Bearer ${response.body.accessToken as string}`;
  }

  it('keeps times when reminders are switched off or the timezone changes, and never touches another account', async () => {
    const mine = await signUp('reminder-a');
    const theirs = await signUp('reminder-b');

    const saved = await request(app).patch('/api/profile').set('Authorization', mine)
      .send({ notificationsEnabled: true, reminderTimes: ['18:30', '08:00', '12:00'] });
    expect(saved.status).toBe(200);
    expect(saved.body.user).toMatchObject({ notificationsEnabled: true, reminderTimes: ['08:00', '12:00', '18:30'] });

    const moved = await request(app).patch('/api/profile').set('Authorization', mine).send({ timezone: 'Asia/Tokyo' });
    expect(moved.body.user).toMatchObject({ timezone: 'Asia/Tokyo', notificationsEnabled: true, reminderTimes: ['08:00', '12:00', '18:30'] });

    const off = await request(app).patch('/api/profile').set('Authorization', mine).send({ notificationsEnabled: false });
    expect(off.body.user).toMatchObject({ notificationsEnabled: false, reminderTimes: ['08:00', '12:00', '18:30'] });

    const other = await request(app).get('/api/profile').set('Authorization', theirs);
    expect(other.body.user).toMatchObject({ notificationsEnabled: false, reminderTimes: ['08:00', '12:30', '18:30'] });
  });

  it('rejects an invalid schedule without changing the stored one', async () => {
    const auth = await signUp('reminder-c');
    const bad = await request(app).patch('/api/profile').set('Authorization', auth).send({ reminderTimes: ['09:00', '09:00'] });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_REQUEST');
    const profile = await request(app).get('/api/profile').set('Authorization', auth);
    expect(profile.body.user.reminderTimes).toEqual(['08:00', '12:30', '18:30']);
  });
});
