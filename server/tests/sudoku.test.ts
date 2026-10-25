import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { REWARD_PER_SUDOKU_GAME } from '../src/rewards.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

const secret = 'test-secret-at-least-32-characters-long';
const app = createApp({ jwtSecret: secret, jwtExpiresIn: '7d', allowedOrigins: [] });
const game = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('sudoku routes without a database', () => {
  const token = jwt.sign({}, secret, { subject: new Types.ObjectId().toString() });

  it('require a sign-in and a valid game id', async () => {
    expect((await request(app).post('/api/sudoku/games').send({ gameId: game(1) })).status).toBe(401);
    expect((await request(app).get('/api/rewards')).status).toBe(401);
    const bad = await request(app).post('/api/sudoku/games').set('Authorization', `Bearer ${token}`).send({ gameId: 'x' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_REQUEST');
  });
});

describe.skipIf(!process.env.TEST_MONGODB_URI)('sudoku energy cost and rewards', () => {
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
  const progress = async (auth: string) => (await request(app).get('/api/progress').set('Authorization', auth)).body.progress;
  const logMeals = async (auth: string, count: number) => {
    for (let i = 0; i < count; i++) {
      await request(app).post('/api/meals').set('Authorization', auth).send({ name: `m${i}`, mealType: 'snack', eatenAt: new Date().toISOString() });
    }
  };

  it('charges 5 energy once when a game starts: five meals for a five-meal target go from 100% to 90%', async () => {
    const auth = await signUp('sudoku-energy');
    await request(app).patch('/api/profile').set('Authorization', auth).send({ dailyMealGoal: 5, timezone: 'UTC' });
    await logMeals(auth, 5);
    expect((await progress(auth)).energy).toMatchObject({ points: 50, target: 50, fill: 100 });

    const started = await request(app).post('/api/sudoku/games').set('Authorization', auth).send({ gameId: game(1) });
    expect(started.status).toBe(201);
    expect((await progress(auth)).energy).toMatchObject({ points: 45, fill: 90 });
  });

  it('never charges twice for the same game, however often the start or resume is repeated', async () => {
    const auth = await signUp('sudoku-once');
    await request(app).patch('/api/profile').set('Authorization', auth).send({ timezone: 'UTC' });
    const first = await request(app).post('/api/sudoku/games').set('Authorization', auth).send({ gameId: game(2) });
    const again = await request(app).post('/api/sudoku/games').set('Authorization', auth).send({ gameId: game(2) });
    expect([first.status, again.status]).toEqual([201, 200]);
    expect((await progress(auth)).energy.points).toBe(-5);

    await request(app).post('/api/sudoku/games').set('Authorization', auth).send({ gameId: game(3) });
    expect((await progress(auth)).energy.points).toBe(-10); // a different game costs again; the balance may go below zero
    expect((await progress(auth)).energy.fill).toBe(0);
  });

  it('lets earnings offset a negative balance first', async () => {
    const auth = await signUp('sudoku-offset');
    await request(app).patch('/api/profile').set('Authorization', auth).send({ timezone: 'UTC' });
    await request(app).post('/api/sudoku/games').set('Authorization', auth).send({ gameId: game(4) });
    await logMeals(auth, 1);
    expect((await progress(auth)).energy.points).toBe(5);
  });

  it('awards reward points once per completed game, separate from energy', async () => {
    const auth = await signUp('sudoku-reward');
    await request(app).patch('/api/profile').set('Authorization', auth).send({ timezone: 'UTC' });
    await request(app).post('/api/sudoku/games').set('Authorization', auth).send({ gameId: game(5) });
    expect((await request(app).get('/api/rewards').set('Authorization', auth)).body.points).toBe(0);

    const done = await request(app).post(`/api/sudoku/games/${game(5)}/complete`).set('Authorization', auth);
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ rewardPointsAwarded: REWARD_PER_SUDOKU_GAME, points: REWARD_PER_SUDOKU_GAME });

    const repeated = await request(app).post(`/api/sudoku/games/${game(5)}/complete`).set('Authorization', auth);
    expect(repeated.body).toMatchObject({ rewardPointsAwarded: 0, points: REWARD_PER_SUDOKU_GAME });
    expect((await request(app).get('/api/rewards').set('Authorization', auth)).body.points).toBe(REWARD_PER_SUDOKU_GAME);
    expect((await progress(auth)).energy.points).toBe(-5); // rewards never touch energy
  });

  it('cannot complete a game that was never started, or someone else\'s game', async () => {
    const owner = await signUp('sudoku-a');
    const other = await signUp('sudoku-b');
    await request(app).post('/api/sudoku/games').set('Authorization', owner).send({ gameId: game(6) });

    const unknown = await request(app).post(`/api/sudoku/games/${game(7)}/complete`).set('Authorization', owner);
    expect(unknown.status).toBe(404);
    const foreign = await request(app).post(`/api/sudoku/games/${game(6)}/complete`).set('Authorization', other);
    expect(foreign.status).toBe(404);
    expect((await request(app).get('/api/rewards').set('Authorization', other)).body.points).toBe(0);
    expect((await request(app).get('/api/rewards').set('Authorization', owner)).body.points).toBe(0);
  });

  it('removes a deleted account\'s games', async () => {
    const auth = await signUp('sudoku-delete');
    await request(app).post('/api/sudoku/games').set('Authorization', auth).send({ gameId: game(8) });
    expect((await request(app).delete('/api/auth/me').set('Authorization', auth)).status).toBe(204);
    const { SudokuGame } = await import('../src/models/sudoku-game.js');
    expect(await SudokuGame.countDocuments({ clientId: game(8) })).toBe(0);
  });
});
