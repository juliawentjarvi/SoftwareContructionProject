import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp({
  jwtSecret: 'test-secret-at-least-32-characters-long',
  jwtExpiresIn: '7d',
  allowedOrigins: ['http://localhost:8081'],
});

describe('API boundary', () => {
  it('reports service health without database credentials', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('requires a bearer token for meal data', async () => {
    const response = await request(app).get('/api/meals');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('requires a bearer token before account deletion', async () => {
    const response = await request(app).delete('/api/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects invalid login input before accessing the database', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'bad-email', password: '' });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: expect.any(String),
      },
    });
  });
});