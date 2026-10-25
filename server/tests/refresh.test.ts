import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

const secret = 'test-secret-at-least-32-characters-long';
const app = createApp({ jwtSecret: secret, jwtExpiresIn: '30d', allowedOrigins: [] });

describe('session refresh without a database', () => {
  it('requires a valid token', async () => {
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
    const expired = jwt.sign({}, secret, { subject: new Types.ObjectId().toString(), expiresIn: -10 });
    expect((await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${expired}`)).status).toBe(401);
  });
});

describe.skipIf(!process.env.TEST_MONGODB_URI)('session refresh', () => {
  const createdUserIds: Types.ObjectId[] = [];

  beforeAll(async () => {
    configureTestMongoDns();
    await mongoose.connect(getTestMongoUri());
  });
  afterEach(async () => {
    await cleanTestAccounts(createdUserIds.splice(0));
  });
  afterAll(disconnectTestDatabase);

  it('returns the profile and a fresh token for a signed-in user, so use keeps the session alive', async () => {
    const registered = await request(app).post('/api/auth/register').send(createTestIdentity('refresh'));
    createdUserIds.push(new Types.ObjectId(registered.body.user.id));

    const refreshed = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${registered.body.accessToken as string}`);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.user.id).toBe(registered.body.user.id);
    expect(JSON.stringify(refreshed.body)).not.toMatch(/passwordHash/);
    const decoded = jwt.verify(refreshed.body.accessToken as string, secret) as jwt.JwtPayload;
    expect(decoded.sub).toBe(registered.body.user.id);
    expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBe(30 * 24 * 60 * 60);

    const withNew = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${refreshed.body.accessToken as string}`);
    expect(withNew.status).toBe(200);
  });

  it('answers 401 once the account no longer exists', async () => {
    const registered = await request(app).post('/api/auth/register').send(createTestIdentity('refresh-gone'));
    const token = registered.body.accessToken as string;
    expect((await request(app).delete('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(204);
    const refreshed = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${token}`);
    expect(refreshed.status).toBe(401);
    expect(refreshed.body.error.code).toBe('UNAUTHORIZED');
  });
});
