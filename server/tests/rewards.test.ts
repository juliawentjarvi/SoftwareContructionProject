import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { CATALOG, findItem } from '../src/rewards.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

const secret = 'test-secret-at-least-32-characters-long';
const app = createApp({ jwtSecret: secret, jwtExpiresIn: '7d', allowedOrigins: [] });
const uuid = (n: number, prefix = 1) => `${String(prefix).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('reward catalog', () => {
  it('has treats, appearance options and themes with positive whole-number prices, except the free default theme', () => {
    expect(new Set(CATALOG.map((item) => item.kind))).toEqual(new Set(['treat', 'appearance', 'theme']));
    for (const item of CATALOG) {
      expect(Number.isInteger(item.cost)).toBe(true);
      expect(item.cost).toBeGreaterThanOrEqual(0);
    }
    expect(findItem('meadow')?.cost).toBe(0);
    expect(CATALOG.filter((item) => item.cost === 0).map((item) => item.id)).toEqual(['meadow']);
    expect(new Set(CATALOG.map((item) => item.id)).size).toBe(CATALOG.length);
  });
});

describe('reward routes without a database', () => {
  const token = jwt.sign({}, secret, { subject: new Types.ObjectId().toString() });

  it('require a sign-in and a known item', async () => {
    expect((await request(app).post('/api/rewards/unlock').send({ itemId: 'bow' })).status).toBe(401);
    const unknown = await request(app).post('/api/rewards/unlock').set('Authorization', `Bearer ${token}`).send({ itemId: 'nope' });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('INVALID_REQUEST');
  });
});

describe.skipIf(!process.env.TEST_MONGODB_URI)('reward points, unlocks and treats', () => {
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
    const auth = `Bearer ${response.body.accessToken as string}`;
    await request(app).patch('/api/profile').set('Authorization', auth).send({ timezone: 'UTC' });
    return auth;
  }
  /** Earn `games * 10` reward points by completing Sudoku games. */
  async function earn(auth: string, games: number, base = 100) {
    for (let i = 0; i < games; i++) {
      const id = uuid(base + i, 9);
      await request(app).post('/api/sudoku/games').set('Authorization', auth).send({ gameId: id });
      await request(app).post(`/api/sudoku/games/${id}/complete`).set('Authorization', auth);
    }
  }
  const rewards = async (auth: string) => (await request(app).get('/api/rewards').set('Authorization', auth)).body;
  const unlock = (auth: string, body: object) => request(app).post('/api/rewards/unlock').set('Authorization', auth).send(body);

  it('starts with zero points and the free default theme', async () => {
    const auth = await signUp('rw-new');
    const state = await rewards(auth);
    expect(state.points).toBe(0);
    expect(state.unlocked).toEqual(['meadow']);
    expect(state.catalog.length).toBe(CATALOG.length);
  });

  it('spends points on an unlock exactly once, however often it is repeated', async () => {
    const auth = await signUp('rw-spend');
    await earn(auth, 3); // 30 points
    const first = await unlock(auth, { itemId: 'bow' });
    expect(first.status).toBe(201);
    expect(first.body.points).toBe(30 - (findItem('bow')?.cost ?? 0));
    const again = await unlock(auth, { itemId: 'bow' });
    expect(again.status).toBe(200);
    expect(again.body.points).toBe(first.body.points);
    expect((await rewards(auth)).unlocked).toContain('bow');
  });

  it('refuses to spend below zero and changes nothing', async () => {
    const auth = await signUp('rw-poor');
    await earn(auth, 1); // 10 points
    const tooDear = await unlock(auth, { itemId: 'sunglasses' });
    expect(tooDear.status).toBe(409);
    expect(tooDear.body.error.code).toBe('INSUFFICIENT_POINTS');
    const state = await rewards(auth);
    expect(state.points).toBe(10);
    expect(state.unlocked).not.toContain('sunglasses');
  });

  it('cannot be tricked into overspending with simultaneous requests', async () => {
    const auth = await signUp('rw-race');
    await earn(auth, 3); // 30 points
    const results = await Promise.all([unlock(auth, { itemId: 'bow' }), unlock(auth, { itemId: 'night' }), unlock(auth, { itemId: 'party-hat' })]);
    const state = await rewards(auth);
    expect(state.points).toBeGreaterThanOrEqual(0);
    const spent = state.unlocked.filter((id: string) => id !== 'meadow').reduce((sum: number, id: string) => sum + (findItem(id)?.cost ?? 0), 0);
    expect(spent + state.points).toBe(30);
    expect(results.some((r) => r.status === 201)).toBe(true);
  });

  it('sells a treat each time it is bought with a new purchase id, but never twice for the same purchase id', async () => {
    const auth = await signUp('rw-treat');
    await earn(auth, 2); // 20 points
    const cost = findItem('honey')!.cost;
    const one = await unlock(auth, { itemId: 'honey', purchaseId: uuid(1) });
    const repeat = await unlock(auth, { itemId: 'honey', purchaseId: uuid(1) });
    const two = await unlock(auth, { itemId: 'honey', purchaseId: uuid(2) });
    expect([one.status, repeat.status, two.status]).toEqual([201, 200, 201]);
    expect(two.body.points).toBe(20 - 2 * cost);
    const missing = await unlock(auth, { itemId: 'honey' });
    expect(missing.status).toBe(400); // a treat needs a purchase id so a retry cannot buy twice
  });

  it('lets a theme or appearance option be chosen only after it is unlocked, and cleared again', async () => {
    const auth = await signUp('rw-equip');
    await earn(auth, 3);
    const locked = await request(app).patch('/api/profile').set('Authorization', auth).send({ selectedAccessory: 'bow' });
    expect(locked.status).toBe(409);
    await unlock(auth, { itemId: 'bow' });
    const chosen = await request(app).patch('/api/profile').set('Authorization', auth).send({ selectedAccessory: 'bow', selectedTheme: 'meadow' });
    expect(chosen.status).toBe(200);
    expect(chosen.body.user).toMatchObject({ selectedAccessory: 'bow', selectedTheme: 'meadow' });
    const cleared = await request(app).patch('/api/profile').set('Authorization', auth).send({ selectedAccessory: null });
    expect(cleared.body.user.selectedAccessory).toBeNull();
    const wrongKind = await request(app).patch('/api/profile').set('Authorization', auth).send({ selectedTheme: 'bow' });
    expect(wrongKind.status).toBe(400);
  });

  it('keeps reward points separate from energy and from other accounts', async () => {
    const mine = await signUp('rw-mine');
    const other = await signUp('rw-other');
    await earn(mine, 2);
    await unlock(mine, { itemId: 'bow' });
    expect((await request(app).get('/api/progress').set('Authorization', mine)).body.progress.energy.points).toBe(-10); // two game starts only
    expect((await rewards(other)).points).toBe(0);
    expect((await rewards(other)).unlocked).toEqual(['meadow']);
  });
});
