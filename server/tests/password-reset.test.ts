import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

const sent: { email: string; token: string }[] = [];
let app: ReturnType<typeof createApp>;

// Auth routes are rate limited per app instance, so each test gets its own.
beforeEach(() => {
  sent.length = 0;
  app = createApp({
    jwtSecret: 'test-secret-at-least-32-characters-long',
    jwtExpiresIn: '7d',
    allowedOrigins: [],
    sendPasswordReset: async (email, token) => { sent.push({ email, token }); },
  });
});

describe('password reset input', () => {
  it('rejects a malformed email on request and a short password on confirmation before touching the database', async () => {
    expect((await request(app).post('/api/auth/password-reset/request').send({ email: 'nope' })).status).toBe(400);
    const confirm = await request(app).post('/api/auth/password-reset/confirm').send({ token: 'x'.repeat(20), password: 'short' });
    expect(confirm.status).toBe(400);
    expect(confirm.body.error.code).toBe('INVALID_REQUEST');
  });
});

describe.skipIf(!process.env.TEST_MONGODB_URI)('password reset', () => {
  const createdUserIds: Types.ObjectId[] = [];

  beforeAll(async () => {
    configureTestMongoDns();
    await mongoose.connect(getTestMongoUri());
  });
  afterEach(async () => {
    await cleanTestAccounts(createdUserIds.splice(0));
  });
  afterAll(disconnectTestDatabase);

  async function account() {
    const identity = createTestIdentity('reset');
    const response = await request(app).post('/api/auth/register').send(identity);
    expect(response.status).toBe(201);
    createdUserIds.push(new Types.ObjectId(response.body.user.id));
    return identity;
  }

  async function requestReset(email: string) {
    return request(app).post('/api/auth/password-reset/request').send({ email });
  }

  it('answers identically for known and unknown emails, and only sends to a real account', async () => {
    const identity = await account();
    const known = await requestReset(` ${identity.email.toUpperCase()} `);
    const unknown = await requestReset(createTestIdentity('nobody').email);

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toHaveLength(1);
    expect(sent[0]!.email).toBe(identity.email);
    expect(JSON.stringify(known.body)).not.toContain(sent[0]!.token);
  });

  it('stores only a hash of the reset token', async () => {
    const identity = await account();
    await requestReset(identity.email);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const stored = await User.findOne({ email: identity.email }).select('+passwordResetHash +passwordResetExpires');
    expect(stored?.passwordResetHash).toBeTruthy();
    expect(stored?.passwordResetHash).not.toBe(sent[0]!.token);
    expect(stored!.passwordResetExpires!.getTime()).toBeGreaterThan(Date.now());
  });

  it('changes the password once with a valid token, and the token cannot be reused', async () => {
    const identity = await account();
    await requestReset(identity.email);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const token = sent[0]!.token;
    const newPassword = `${identity.password}-new`;

    const confirmed = await request(app).post('/api/auth/password-reset/confirm').send({ token, password: newPassword });
    expect(confirmed.status).toBe(204);

    expect((await request(app).post('/api/auth/login').send({ email: identity.email, password: identity.password })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: identity.email, password: newPassword })).status).toBe(200);

    const reused = await request(app).post('/api/auth/password-reset/confirm').send({ token, password: `${newPassword}-again` });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects an expired token, a wrong token, and a token superseded by a newer request', async () => {
    const identity = await account();
    await requestReset(identity.email);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const first = sent[0]!.token;

    await User.updateOne({ email: identity.email }, { passwordResetExpires: new Date(Date.now() - 1000) });
    const expired = await request(app).post('/api/auth/password-reset/confirm').send({ token: first, password: 'a-new-long-password' });
    expect(expired.status).toBe(400);
    expect(expired.body.error.code).toBe('INVALID_RESET_TOKEN');

    const wrong = await request(app).post('/api/auth/password-reset/confirm').send({ token: 'w'.repeat(43), password: 'a-new-long-password' });
    expect(wrong.body.error).toEqual(expired.body.error);

    await requestReset(identity.email);
    await requestReset(identity.email);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const superseded = await request(app).post('/api/auth/password-reset/confirm').send({ token: sent[1]!.token, password: 'a-new-long-password' });
    expect(superseded.status).toBe(400);
    const latest = await request(app).post('/api/auth/password-reset/confirm').send({ token: sent[2]!.token, password: 'a-new-long-password' });
    expect(latest.status).toBe(204);
  });
});
