import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { profilePatchSchema } from '../src/validation.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

const app = createApp({ jwtSecret: 'test-secret-at-least-32-characters-long', jwtExpiresIn: '7d', allowedOrigins: [] });

describe('expected versions in requests', () => {
  it('accepts non-negative whole-number versions and rejects anything else', () => {
    expect(profilePatchSchema.safeParse({ displayName: 'A', expectedVersions: { displayName: 0 } }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ displayName: 'A', expectedVersions: { displayName: -1 } }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ displayName: 'A', expectedVersions: { displayName: 1.5 } }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ displayName: 'A', expectedVersions: 'nope' }).success).toBe(false);
  });

  it('does not count an update that only carries versions as a change', () => {
    expect(profilePatchSchema.safeParse({ expectedVersions: { displayName: 0 } }).success).toBe(false);
  });
});

describe.skipIf(!process.env.TEST_MONGODB_URI)('same-field conflicts and independent fields', () => {
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
  const patch = (auth: string, body: object) => request(app).patch('/api/profile').set('Authorization', auth).send(body);
  const profile = async (auth: string) => (await request(app).get('/api/profile').set('Authorization', auth)).body.user;

  it('starts every field at version 0 and raises a field only when it changes', async () => {
    const auth = await signUp('cc-start');
    const before = await profile(auth);
    expect(before.fieldVersions.displayName ?? 0).toBe(0);
    const after = (await patch(auth, { displayName: 'First' })).body.user;
    expect(after.fieldVersions.displayName).toBe(1);
    expect(after.fieldVersions.stepTarget ?? 0).toBe(0);
  });

  it('keeps the first update and rejects a stale edit of the same field with a recoverable conflict', async () => {
    const auth = await signUp('cc-same');
    const loaded = await profile(auth); // both "sessions" start from this
    const expected = { displayName: loaded.fieldVersions.displayName ?? 0 };

    const first = await patch(auth, { displayName: 'From session A', expectedVersions: expected });
    expect(first.status).toBe(200);

    const stale = await patch(auth, { displayName: 'From session B', expectedVersions: expected });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CONFLICT');
    expect(stale.body.error.details.fields.displayName).toMatchObject({ version: 1, value: 'From session A' });
    expect(stale.body.error.details.user.displayName).toBe('From session A'); // enough to refresh without another request

    expect((await profile(auth)).displayName).toBe('From session A'); // the newer value is intact

    // recover: refresh, then apply the change on top of the latest version
    const latest = await profile(auth);
    const retry = await patch(auth, { displayName: 'From session B', expectedVersions: { displayName: latest.fieldVersions.displayName } });
    expect(retry.status).toBe(200);
    expect(retry.body.user.displayName).toBe('From session B');
    expect(retry.body.user.fieldVersions.displayName).toBe(2);
  });

  it('lets edits to different fields both persist', async () => {
    const auth = await signUp('cc-diff');
    const loaded = await profile(auth);
    const v = loaded.fieldVersions;

    expect((await patch(auth, { displayName: 'Renamed', expectedVersions: { displayName: v.displayName ?? 0 } })).status).toBe(200);
    const other = await patch(auth, { stepTarget: 9000, expectedVersions: { stepTarget: v.stepTarget ?? 0 } }); // based on the older load
    expect(other.status).toBe(200);

    const final = await profile(auth);
    expect(final.displayName).toBe('Renamed');
    expect(final.stepTarget).toBe(9000);
  });

  it('lets exactly one of two simultaneous edits of the same field win', async () => {
    const auth = await signUp('cc-race');
    const loaded = await profile(auth);
    const expected = { displayName: loaded.fieldVersions.displayName ?? 0 };
    const results = await Promise.all([
      patch(auth, { displayName: 'Racer one', expectedVersions: expected }),
      patch(auth, { displayName: 'Racer two', expectedVersions: expected }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results.find((r) => r.status === 200)!.body.user.displayName as string;
    expect((await profile(auth)).displayName).toBe(winner);
    expect((await profile(auth)).fieldVersions.displayName).toBe(1);
  });

  it('treats a change of the meal target as a change of the reminder times too, so a stale reminder edit is rejected', async () => {
    const auth = await signUp('cc-reminders');
    const loaded = await profile(auth);
    const staleReminders = { reminderTimes: loaded.reminderTimes, expectedVersions: { reminderTimes: loaded.fieldVersions.reminderTimes ?? 0 } };
    expect((await patch(auth, { dailyMealGoal: 4 })).status).toBe(200); // reminders are reconciled to four times
    const stale = await patch(auth, staleReminders);
    expect(stale.status).toBe(409);
    expect((await profile(auth)).reminderTimes).toHaveLength(4);
  });

  it('still accepts an update that sends no expected versions', async () => {
    const auth = await signUp('cc-legacy');
    expect((await patch(auth, { displayName: 'Legacy' })).status).toBe(200);
    expect((await patch(auth, { displayName: 'Legacy again' })).status).toBe(200);
    expect((await profile(auth)).fieldVersions.displayName).toBe(2);
  });

  it('applies the same rules to meals and activity entries, and keeps other accounts out', async () => {
    const owner = await signUp('cc-owner');
    const other = await signUp('cc-other');
    const meal = (await request(app).post('/api/meals').set('Authorization', owner).send({ name: 'Soup', mealType: 'lunch', eatenAt: new Date().toISOString() })).body.meal;
    const mealPatch = (auth: string, body: object) => request(app).patch(`/api/meals/${meal._id as string}`).set('Authorization', auth).send(body);

    expect((await mealPatch(owner, { name: 'Stew', expectedVersions: { name: 0 } })).status).toBe(200);
    const staleMeal = await mealPatch(owner, { name: 'Curry', expectedVersions: { name: 0 } });
    expect(staleMeal.status).toBe(409);
    expect(staleMeal.body.error.details.fields.name.value).toBe('Stew');
    expect((await mealPatch(owner, { notes: 'with bread', expectedVersions: { notes: 0 } })).status).toBe(200); // a different field
    expect((await mealPatch(other, { name: 'Hijack', expectedVersions: { name: 0 } })).status).toBe(404);

    const activity = (await request(app).post('/api/activities').set('Authorization', owner).send({ type: 'Walk', occurredAt: new Date().toISOString(), stepCount: 1000 })).body.activity;
    const actPatch = (body: object) => request(app).patch(`/api/activities/${activity._id as string}`).set('Authorization', owner).send(body);
    expect((await actPatch({ stepCount: 2000, expectedVersions: { stepCount: 0 } })).status).toBe(200);
    expect((await actPatch({ stepCount: 3000, expectedVersions: { stepCount: 0 } })).status).toBe(409);
    const clear = await actPatch({ stepCount: null, expectedVersions: { stepCount: 1 } });
    expect(clear.status).toBe(200);
    expect(clear.body.activity.stepCount ?? null).toBeNull();
  });
});
