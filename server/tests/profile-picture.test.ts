import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { profilePictureSchema } from '../src/validation.js';
import { cleanTestAccounts, configureTestMongoDns, createTestIdentity, disconnectTestDatabase, getTestMongoUri } from './test-helpers.js';

const secret = 'test-secret-at-least-32-characters-long';
const app = createApp({ jwtSecret: secret, jwtExpiresIn: '7d', allowedOrigins: [] });

// Tiny valid images: the first bytes (magic numbers) are what the server checks.
const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString('base64')}`;
const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString('base64')}`;
const WEBP = `data:image/webp;base64,${Buffer.from('RIFF1234WEBPVP8 ').toString('base64')}`;

describe('profile picture validation', () => {
  it('accepts small PNG, JPEG and WebP images', () => {
    for (const image of [PNG, JPEG, WEBP]) expect(profilePictureSchema.safeParse({ image }).success).toBe(true);
  });

  it.each([
    ['not a data URL', 'https://example.com/me.png'],
    ['an unsupported type', `data:image/gif;base64,${Buffer.from('GIF89a...').toString('base64')}`],
    ['a script pretending to be an image', `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`],
    ['text that is not base64', 'data:image/png;base64,@@@@'],
    ['a mismatch between the stated type and the bytes', `data:image/png;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]).toString('base64')}`],
    ['an image over 120 KB', `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(130_000)]).toString('base64')}`],
  ])('rejects %s', (_label, image) => {
    expect(profilePictureSchema.safeParse({ image }).success).toBe(false);
  });
});

describe('profile picture routes without a database', () => {
  const token = jwt.sign({}, secret, { subject: new Types.ObjectId().toString() });

  it('require a sign-in and refuse bad images before touching the database', async () => {
    expect((await request(app).put('/api/profile/picture').send({ image: PNG })).status).toBe(401);
    const bad = await request(app).put('/api/profile/picture').set('Authorization', `Bearer ${token}`).send({ image: 'nope' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_REQUEST');
  });

  it('refuses a request body far above the picture limit instead of reading it all', async () => {
    const huge = await request(app).put('/api/profile/picture').set('Authorization', `Bearer ${token}`).send({ image: `data:image/png;base64,${'A'.repeat(400_000)}` });
    expect(huge.status).toBe(413);
  });

  it('keeps the normal small limit on every other route', async () => {
    const response = await request(app).patch('/api/profile').set('Authorization', `Bearer ${token}`).send({ displayName: 'x'.repeat(40_000) });
    expect(response.status).toBe(413);
  });
});

describe.skipIf(!process.env.TEST_MONGODB_URI)('profile picture storage', () => {
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
    createdUserIds.push(new Types.ObjectId(response.body.user.id));
    return { auth: `Bearer ${response.body.accessToken as string}`, user: response.body.user };
  }

  it('starts without a picture, stores one, can replace it and remove it', async () => {
    const { auth, user } = await signUp('pic-owner');
    expect(user.hasProfilePicture).toBe(false);
    expect((await request(app).get('/api/profile/picture').set('Authorization', auth)).body).toEqual({ image: null });

    expect((await request(app).put('/api/profile/picture').set('Authorization', auth).send({ image: PNG })).status).toBe(200);
    expect((await request(app).get('/api/profile/picture').set('Authorization', auth)).body.image).toBe(PNG);
    expect((await request(app).get('/api/profile').set('Authorization', auth)).body.user.hasProfilePicture).toBe(true);

    await request(app).put('/api/profile/picture').set('Authorization', auth).send({ image: JPEG });
    expect((await request(app).get('/api/profile/picture').set('Authorization', auth)).body.image).toBe(JPEG);

    expect((await request(app).delete('/api/profile/picture').set('Authorization', auth)).status).toBe(204);
    expect((await request(app).get('/api/profile/picture').set('Authorization', auth)).body).toEqual({ image: null });
    expect((await request(app).get('/api/profile').set('Authorization', auth)).body.user.hasProfilePicture).toBe(false);
  });

  it('keeps one account\'s picture private from another and never includes it in profile responses', async () => {
    const mine = await signUp('pic-a');
    const other = await signUp('pic-b');
    await request(app).put('/api/profile/picture').set('Authorization', mine.auth).send({ image: PNG });

    expect((await request(app).get('/api/profile/picture').set('Authorization', other.auth)).body).toEqual({ image: null });
    const profile = await request(app).get('/api/profile').set('Authorization', mine.auth);
    expect(JSON.stringify(profile.body)).not.toContain('base64');
  });
});
