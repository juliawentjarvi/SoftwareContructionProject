import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

const testMongoUri = process.env.TEST_MONGODB_URI;
const app = createApp({
  jwtSecret: 'test-secret-at-least-32-characters-long',
  jwtExpiresIn: '7d',
  allowedOrigins: [],
});
const createdUserIds: Types.ObjectId[] = [];

describe.skipIf(!testMongoUri)('user-owned meal records', () => {
  beforeAll(async () => {
    configureTestMongoDns();
    await mongoose.connect(getTestMongoUri());
  });

  afterEach(async () => {
    await cleanTestAccounts(createdUserIds.splice(0));
  });

  afterAll(disconnectTestDatabase);

  it('prevents a second authenticated user from reading or changing another user meal', async () => {
    const identityA = createTestIdentity('owner-a');
    const identityB = createTestIdentity('owner-b');

    const registrationA = await request(app).post('/api/auth/register').send(identityA);
    expect(registrationA.status).toBe(201);
    createdUserIds.push(new Types.ObjectId(registrationA.body.user.id));

    const registrationB = await request(app).post('/api/auth/register').send(identityB);
    expect(registrationB.status).toBe(201);
    createdUserIds.push(new Types.ObjectId(registrationB.body.user.id));

    const mealResponse = await request(app)
      .post('/api/meals')
      .set('Authorization', `Bearer ${registrationA.body.accessToken}`)
      .send({ name: 'Private meal', mealType: 'lunch', eatenAt: new Date().toISOString() });
    expect(mealResponse.status).toBe(201);
    const mealId = mealResponse.body.meal._id as string;

    const foreignList = await request(app)
      .get('/api/meals')
      .set('Authorization', `Bearer ${registrationB.body.accessToken}`);
    expect(foreignList.status).toBe(200);
    expect(foreignList.body.meals).toEqual([]);

    const foreignRead = await request(app)
      .get(`/api/meals/${mealId}`)
      .set('Authorization', `Bearer ${registrationB.body.accessToken}`);
    expect(foreignRead.status).toBe(404);

    const foreignUpdate = await request(app)
      .patch(`/api/meals/${mealId}`)
      .set('Authorization', `Bearer ${registrationB.body.accessToken}`)
      .send({ name: 'Changed by another user' });
    expect(foreignUpdate.status).toBe(404);

    const foreignDelete = await request(app)
      .delete(`/api/meals/${mealId}`)
      .set('Authorization', `Bearer ${registrationB.body.accessToken}`);
    expect(foreignDelete.status).toBe(404);

    const ownerList = await request(app)
      .get('/api/meals')
      .set('Authorization', `Bearer ${registrationA.body.accessToken}`);
    expect(ownerList.body.meals).toHaveLength(1);
    expect(ownerList.body.meals[0]).toMatchObject({ _id: mealId, name: 'Private meal' });
  });
});
