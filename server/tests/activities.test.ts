import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { profilePatchSchema } from '../src/validation.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

const secret = 'test-secret-at-least-32-characters-long';
const app = createApp({ jwtSecret: secret, jwtExpiresIn: '7d', allowedOrigins: [] });
const valid = { type: 'Walk', occurredAt: '2026-10-25T09:00:00+02:00', stepCount: 4200 };

describe('activity input validation', () => {
  const token = jwt.sign({}, secret, { subject: new Types.ObjectId().toString() });
  const post = (body: unknown) => request(app).post('/api/activities').set('Authorization', `Bearer ${token}`).send(body as object);

  it('requires a sign-in', async () => {
    expect((await request(app).get('/api/activities')).status).toBe(401);
  });

  it.each([
    ['an empty type', { type: '  ' }],
    ['a type over 60 characters', { type: 'x'.repeat(61) }],
    ['a negative step count', { stepCount: -1 }],
    ['a fractional step count', { stepCount: 10.5 }],
    ['an absurd step count', { stepCount: 5_000_000 }],
    ['a time without an offset', { occurredAt: '2026-10-25T09:00:00' }],
    ['notes over 280 characters', { notes: 'x'.repeat(281) }],
  ])('rejects %s', async (_label, override) => {
    const response = await post({ ...valid, ...override });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: 'INVALID_REQUEST', message: expect.any(String) } });
  });
});

describe('step target in the profile', () => {
  it('accepts a positive whole number or null (not set) and rejects zero, negatives and fractions', () => {
    expect(profilePatchSchema.safeParse({ stepTarget: 8000 }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ stepTarget: 25000 }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ stepTarget: null }).success).toBe(true);
    for (const stepTarget of [0, -5, 7.5]) expect(profilePatchSchema.safeParse({ stepTarget }).success).toBe(false);
  });
});

describe.skipIf(!process.env.TEST_MONGODB_URI)('activity entries', () => {
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

  it('lets an owner create, list, change and delete entries, with the instant stored exactly', async () => {
    const auth = await signUp('act-owner');
    const created = await request(app).post('/api/activities').set('Authorization', auth).send(valid);
    expect(created.status).toBe(201);
    expect(new Date(created.body.activity.occurredAt).toISOString()).toBe('2026-10-25T07:00:00.000Z');
    const id = created.body.activity._id as string;

    const list = await request(app).get('/api/activities').set('Authorization', auth);
    expect(list.body.activities).toHaveLength(1);

    const changed = await request(app).patch(`/api/activities/${id}`).set('Authorization', auth).send({ stepCount: 9000 });
    expect(changed.body.activity.stepCount).toBe(9000);

    expect((await request(app).delete(`/api/activities/${id}`).set('Authorization', auth)).status).toBe(204);
    expect((await request(app).get('/api/activities').set('Authorization', auth)).body.activities).toEqual([]);
  });

  it('allows an entry without steps and keeps that distinct from zero steps', async () => {
    const auth = await signUp('act-nosteps');
    const none = await request(app).post('/api/activities').set('Authorization', auth).send({ type: 'Yoga', occurredAt: '2026-10-25T09:00:00Z' });
    expect(none.status).toBe(201);
    expect(none.body.activity.stepCount ?? null).toBeNull();
    const zero = await request(app).post('/api/activities').set('Authorization', auth).send({ type: 'Rest day', occurredAt: '2026-10-25T10:00:00Z', stepCount: 0 });
    expect(zero.body.activity.stepCount).toBe(0);
  });

  it('keeps one user from reading, changing or deleting another user\'s entries', async () => {
    const owner = await signUp('act-a');
    const other = await signUp('act-b');
    const created = await request(app).post('/api/activities').set('Authorization', owner).send(valid);
    const id = created.body.activity._id as string;

    expect((await request(app).get('/api/activities').set('Authorization', other)).body.activities).toEqual([]);
    for (const response of [
      await request(app).patch(`/api/activities/${id}`).set('Authorization', other).send({ stepCount: 1 }),
      await request(app).delete(`/api/activities/${id}`).set('Authorization', other),
    ]) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
    expect((await request(app).get('/api/activities').set('Authorization', owner)).body.activities[0].stepCount).toBe(4200);
  });

  it('reports steps and energy in progress, and recalculates after a correction or deletion', async () => {
    const auth = await signUp('act-progress');
    await request(app).patch('/api/profile').set('Authorization', auth).send({ timezone: 'UTC', stepTarget: 5000 });
    const now = new Date();
    const at = now.toISOString();

    const before = await request(app).get('/api/progress').set('Authorization', auth);
    expect(before.body.progress.steps).toBeNull();
    expect(before.body.progress.stepsMet).toBe(false);
    expect(before.body.progress.stepTarget).toBe(5000);

    await request(app).post('/api/meals').set('Authorization', auth).send({ name: 'Soup', mealType: 'lunch', eatenAt: at });
    const walk = await request(app).post('/api/activities').set('Authorization', auth).send({ type: 'Walk', occurredAt: at, stepCount: 5600 });

    const after = await request(app).get('/api/progress').set('Authorization', auth);
    expect(after.body.progress.steps).toBe(5600);
    expect(after.body.progress.stepsMet).toBe(true);
    expect(after.body.progress.energy).toMatchObject({ points: 35, target: 30 }); // 10 + 5*5
    expect(after.body.progress.energy.fill).toBe(100);

    await request(app).patch(`/api/activities/${walk.body.activity._id as string}`).set('Authorization', auth).send({ stepCount: 1200 });
    const corrected = await request(app).get('/api/progress').set('Authorization', auth);
    expect(corrected.body.progress.energy.points).toBe(15);
    expect(corrected.body.progress.stepsMet).toBe(false);

    await request(app).delete(`/api/activities/${walk.body.activity._id as string}`).set('Authorization', auth);
    const removed = await request(app).get('/api/progress').set('Authorization', auth);
    expect(removed.body.progress.steps).toBeNull();
    expect(removed.body.progress.energy.points).toBe(10);
  });
});
