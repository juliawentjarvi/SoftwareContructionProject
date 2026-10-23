import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

const secret = 'test-secret-at-least-32-characters-long';
const app = createApp({ jwtSecret: secret, jwtExpiresIn: '7d', allowedOrigins: [] });
const validMeal = { name: 'Oatmeal', mealType: 'breakfast', eatenAt: '2026-10-01T08:00:00+02:00' };

describe('meal input validation', () => {
  // Validation runs before any database access, so a signed token for an arbitrary id is enough here.
  const token = jwt.sign({}, secret, { subject: new Types.ObjectId().toString() });
  const post = (body: unknown) => request(app).post('/api/meals').set('Authorization', `Bearer ${token}`).send(body as object);

  it.each([
    ['an empty name', { name: '   ' }],
    ['a name over 100 characters', { name: 'x'.repeat(101) }],
    ['an unknown meal type', { mealType: 'brunch' }],
    ['notes over 280 characters', { notes: 'x'.repeat(281) }],
    ['a time without a UTC offset', { eatenAt: '2026-10-01T08:00:00' }],
    ['a non-date time', { eatenAt: 'yesterday' }],
  ])('rejects %s', async (_label, override) => {
    const response = await post({ ...validMeal, ...override });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: 'INVALID_REQUEST', message: expect.any(String) } });
  });

  it('rejects an invalid meal id', async () => {
    const response = await request(app).delete('/api/meals/not-an-id').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_ID');
  });
});

describe.skipIf(!process.env.TEST_MONGODB_URI)('meal records', () => {
  const createdUserIds: Types.ObjectId[] = [];

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

  it('stores the exact instant for a time entered with a UTC offset and trims text', async () => {
    const auth = await signUp('meal-time');
    const created = await request(app).post('/api/meals').set('Authorization', auth)
      .send({ ...validMeal, name: '  Oatmeal  ', notes: '  with berries ' });
    expect(created.status).toBe(201);
    expect(created.body.meal).toMatchObject({ name: 'Oatmeal', notes: 'with berries' });
    expect(new Date(created.body.meal.eatenAt).toISOString()).toBe('2026-10-01T06:00:00.000Z');

    const list = await request(app).get('/api/meals').set('Authorization', auth);
    expect(list.body.meals[0].eatenAt).toBe('2026-10-01T06:00:00.000Z');
  });

  it('lets an owner read, update and delete a meal, and hides it from other users', async () => {
    const owner = await signUp('meal-owner');
    const other = await signUp('meal-other');
    const created = await request(app).post('/api/meals').set('Authorization', owner).send(validMeal);
    const id = created.body.meal._id as string;

    expect((await request(app).get(`/api/meals/${id}`).set('Authorization', owner)).body.meal).toMatchObject({ _id: id, name: 'Oatmeal' });

    for (const response of [
      await request(app).get(`/api/meals/${id}`).set('Authorization', other),
      await request(app).patch(`/api/meals/${id}`).set('Authorization', other).send({ name: 'Hijacked' }),
      await request(app).delete(`/api/meals/${id}`).set('Authorization', other),
    ]) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
    }

    const updated = await request(app).patch(`/api/meals/${id}`).set('Authorization', owner).send({ name: 'Porridge' });
    expect(updated.body.meal.name).toBe('Porridge');
    expect((await request(app).delete(`/api/meals/${id}`).set('Authorization', owner)).status).toBe(204);
    expect((await request(app).get(`/api/meals/${id}`).set('Authorization', owner)).status).toBe(404);
  });
});
