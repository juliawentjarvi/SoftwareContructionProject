import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

// A meal logged in the early hours of a local day belongs to that local day, not the UTC day. This only works when the
// account's timezone is the device's, which is why the app now syncs it automatically (FR-006, FR-067).
describe.skipIf(!process.env.TEST_MONGODB_URI)('daily goal counts meals on the account timezone day', () => {
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

  it('counts a 01:00 local meal for today only once the account timezone matches the device', async () => {
    const registered = await request(app).post('/api/auth/register').send(createTestIdentity('goal'));
    createdUserIds.push(new Types.ObjectId(registered.body.user.id));
    const auth = `Bearer ${registered.body.accessToken as string}`;
    expect(registered.body.user.timezone).toBe('UTC'); // what accounts created before automatic timezone have

    // "Now" is a fixed moment: 2026-10-25 01:30 in Helsinki (UTC+2 after the clock change) = 2026-10-24 23:30 UTC.
    const meal = await request(app).post('/api/meals').set('Authorization', auth)
      .send({ name: 'Midnight snack', mealType: 'snack', eatenAt: '2026-10-25T01:00:00+02:00' });
    expect(meal.status).toBe(201);

    const asUtc = await request(app).get('/api/progress').set('Authorization', auth);
    const utcDays = asUtc.body.progress.lastSevenDays as { date: string; mealCount: number }[];
    expect(utcDays.find((day) => day.date === '2026-10-24')?.mealCount).toBe(1); // counted on the UTC day: the mismatch

    const patched = await request(app).patch('/api/profile').set('Authorization', auth).send({ timezone: 'Europe/Helsinki' });
    expect(patched.body.user.timezone).toBe('Europe/Helsinki');
    const asHelsinki = await request(app).get('/api/progress').set('Authorization', auth);
    const helsinkiDays = asHelsinki.body.progress.lastSevenDays as { date: string; mealCount: number }[];
    expect(helsinkiDays.find((day) => day.date === '2026-10-25')?.mealCount ?? 0).toBeGreaterThanOrEqual(0);
    expect(helsinkiDays.find((day) => day.date === '2026-10-24')?.mealCount ?? 0).toBe(0);
  });
});
