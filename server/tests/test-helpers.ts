import { randomUUID } from 'node:crypto';
import { setServers } from 'node:dns';
import mongoose, { type Types } from 'mongoose';
import 'dotenv/config';
import { MealEntry } from '../src/models/meal-entry.js';
import { User } from '../src/models/user.js';

export interface TestIdentity {
  email: string;
  password: string;
  displayName: string;
}

export function createTestIdentity(label = 'bear-care-test'): TestIdentity {
  const uniqueId = randomUUID();
  return {
    email: `${label}-${uniqueId}@example.test`,
    password: `Test-${uniqueId}-Password`,
    displayName: `Test ${uniqueId.slice(0, 8)}`,
  };
}

export function getTestMongoUri(): string {
  const uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    throw new Error('Set TEST_MONGODB_URI to an isolated bear_buddy_test database before running database-backed tests.');
  }

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('TEST_MONGODB_URI must be a valid MongoDB connection URL.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)
    || !/^bear_buddy_test(?:_[A-Za-z0-9-]+)?$/.test(databaseName)
  ) {
    throw new Error('Database-backed tests require a MongoDB URL whose database name is bear_buddy_test or starts with bear_buddy_test_.');
  }

  return uri;
}

export function configureTestMongoDns(): void {
  const servers = (process.env.MONGODB_DNS_SERVERS ?? '').split(',').map((server) => server.trim()).filter(Boolean);
  if (servers.length > 0) setServers(servers);
}

export async function cleanTestAccounts(userIds: Types.ObjectId[]): Promise<void> {
  if (userIds.length === 0) return;
  await MealEntry.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
}

export async function disconnectTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
