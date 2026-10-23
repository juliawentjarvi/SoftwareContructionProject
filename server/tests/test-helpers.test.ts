import { describe, expect, it } from 'vitest';
import { createTestIdentity, getTestMongoUri } from './test-helpers.js';

describe('database test safety helpers', () => {
  it('creates a unique identity for each test account', () => {
    const first = createTestIdentity();
    const second = createTestIdentity();

    expect(first.email).not.toBe(second.email);
    expect(first.password).not.toBe(second.password);
  });

  it('rejects a missing explicit test database URL', () => {
    const previous = process.env.TEST_MONGODB_URI;
    delete process.env.TEST_MONGODB_URI;

    try {
      expect(() => getTestMongoUri()).toThrow('Set TEST_MONGODB_URI');
    } finally {
      if (previous === undefined) delete process.env.TEST_MONGODB_URI;
      else process.env.TEST_MONGODB_URI = previous;
    }
  });

  it('rejects a database URL that is not explicitly named for tests', () => {
    const previous = process.env.TEST_MONGODB_URI;
    process.env.TEST_MONGODB_URI = 'mongodb://localhost:27017/bear_buddy';

    try {
      expect(() => getTestMongoUri()).toThrow('Database-backed tests require');
    } finally {
      if (previous === undefined) delete process.env.TEST_MONGODB_URI;
      else process.env.TEST_MONGODB_URI = previous;
    }
  });
});
