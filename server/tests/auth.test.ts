import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

// Auth routes are rate limited per app instance, so each test gets its own.
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp({ jwtSecret: 'test-secret-at-least-32-characters-long', jwtExpiresIn: '7d', allowedOrigins: [] });
});

describe('registration and login input', () => {
  it.each([
    ['an invalid email', { email: 'not-an-email' }],
    ['a short password', { password: 'short' }],
    ['a password over 72 bytes', { password: 'x'.repeat(73) }],
    ['an empty display name', { displayName: '   ' }],
    ['an unknown timezone', { timezone: 'Mars/Olympus' }],
  ])('rejects registration with %s before touching the database', async (_label, override) => {
    const response = await request(app).post('/api/auth/register').send({ ...createTestIdentity(), ...override });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toMatch(/^INVALID_/);
  });
});

describe.skipIf(!process.env.TEST_MONGODB_URI)('registration and login accounts', () => {
  const createdUserIds: Types.ObjectId[] = [];

  beforeAll(async () => {
    configureTestMongoDns();
    await mongoose.connect(getTestMongoUri());
    await mongoose.model('User').init();
  });
  afterEach(async () => {
    await cleanTestAccounts(createdUserIds.splice(0));
  });
  afterAll(disconnectTestDatabase);

  async function register(identity = createTestIdentity('auth')) {
    const response = await request(app).post('/api/auth/register').send(identity);
    if (response.status === 201) createdUserIds.push(new Types.ObjectId(response.body.user.id));
    return { identity, response };
  }

  it('registers an account without returning the password or its hash', async () => {
    const { identity, response } = await register();
    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ email: identity.email, displayName: identity.displayName, timezone: 'UTC' });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|password"/);
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects a duplicate account whose email differs only by case or surrounding whitespace', async () => {
    const { identity } = await register();
    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({ ...createTestIdentity(), email: `  ${identity.email.toUpperCase()}  ` });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: { code: 'ACCOUNT_EXISTS', message: expect.any(String) } });
  });

  it('signs in with a valid password regardless of email case, and rejects a wrong password', async () => {
    const { identity } = await register();
    const ok = await request(app).post('/api/auth/login').send({ email: ` ${identity.email.toUpperCase()} `, password: identity.password });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toEqual(expect.any(String));

    const wrong = await request(app).post('/api/auth/login').send({ email: identity.email, password: `${identity.password}x` });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

    const unknown = await request(app).post('/api/auth/login').send({ email: createTestIdentity().email, password: identity.password });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error).toEqual(wrong.body.error);
  });
});
