import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MealEntry } from '../src/models/meal-entry.js';
import { User } from '../src/models/user.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

const app = createApp({ jwtSecret: 'test-secret-at-least-32-characters-long', jwtExpiresIn: '7d', allowedOrigins: [] });

describe.skipIf(!process.env.TEST_MONGODB_URI)('account deletion', () => {
  const createdUserIds: Types.ObjectId[] = [];

  beforeAll(async () => {
    configureTestMongoDns();
    await mongoose.connect(getTestMongoUri());
  });
  afterEach(async () => {
    await cleanTestAccounts(createdUserIds.splice(0));
  });
  afterAll(disconnectTestDatabase);

  it('removes the account and its meals without touching another account', async () => {
    const accounts = [];
    for (const label of ['delete-a', 'delete-b']) {
      const registered = await request(app).post('/api/auth/register').send(createTestIdentity(label));
      expect(registered.status).toBe(201);
      const id = new Types.ObjectId(registered.body.user.id);
      createdUserIds.push(id);
      const auth = `Bearer ${registered.body.accessToken as string}`;
      const meal = await request(app).post('/api/meals').set('Authorization', auth)
        .send({ name: `${label} meal`, mealType: 'lunch', eatenAt: new Date().toISOString() });
      expect(meal.status).toBe(201);
      accounts.push({ id, auth });
    }
    const [deleted, kept] = accounts as [typeof accounts[number], typeof accounts[number]];

    const response = await request(app).delete('/api/auth/me').set('Authorization', deleted.auth);
    expect(response.status).toBe(204);

    expect(await User.countDocuments({ _id: deleted.id })).toBe(0);
    expect(await MealEntry.countDocuments({ userId: deleted.id })).toBe(0);
    expect(await User.countDocuments({ _id: kept.id })).toBe(1);
    expect(await MealEntry.countDocuments({ userId: kept.id })).toBe(1);

    const stale = await request(app).get('/api/auth/me').set('Authorization', deleted.auth);
    expect(stale.status).toBe(401);
    expect((await request(app).get('/api/meals').set('Authorization', kept.auth)).body.meals).toHaveLength(1);
  });
});
