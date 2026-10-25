// API load test (task T052): 25 isolated test users, each making ordinary requests at a steady rate, against a running API.
//
//   TEST_MONGODB_URI=<bear_buddy_test database> JWT_SECRET=<same secret the API uses> API_URL=http://localhost:3100 \
//     node scripts/load-test.mjs
//
// Users are created straight in the (test) database with a signed token, because the sign-up route is rate limited per address.
// Everything it creates is deleted at the end. Refuses to run unless the database name starts with bear_buddy_test.
import { setServers } from 'node:dns';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import 'dotenv/config';
import { ActivityEntry } from '../dist/models/activity-entry.js';
import { MealEntry } from '../dist/models/meal-entry.js';
import { User } from '../dist/models/user.js';

const API = process.env.API_URL ?? 'http://localhost:3100';
const USERS = Number(process.env.USERS ?? 25);
const MINUTES = Number(process.env.MINUTES ?? 5);
const PER_MINUTE = Number(process.env.RPM ?? 12);
const uri = process.env.TEST_MONGODB_URI;
const secret = process.env.JWT_SECRET;
if (!uri || !secret) throw new Error('Set TEST_MONGODB_URI and JWT_SECRET');
const dbName = decodeURIComponent(new URL(uri).pathname.replace(/^\/+/, '').split('/')[0] ?? '');
if (!/^bear_buddy_test/.test(dbName)) throw new Error(`Refusing to run against database "${dbName}"`);
const dns = (process.env.MONGODB_DNS_SERVERS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (dns.length) setServers(dns);

await mongoose.connect(uri);
const tag = `load-${Date.now()}`;
const users = [];
for (let i = 0; i < USERS; i++) {
  const user = await User.create({ email: `${tag}-${i}@example.test`, passwordHash: 'not-a-real-hash', displayName: `Load ${i}`, timezone: 'UTC' });
  users.push({ index: i, id: user._id.toString(), token: jwt.sign({}, secret, { subject: user._id.toString(), expiresIn: '1h' }), created: 0, activities: 0, foreign: 0 });
}

const samples = []; // { name, ms, status }
async function call(user, name, path, init = {}) {
  const started = performance.now();
  let status = 0;
  let body = null;
  try {
    const response = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
    status = response.status;
    body = status === 204 ? null : await response.json().catch(() => null);
  } catch { /* status stays 0: counted as a failure */ }
  samples.push({ name, ms: performance.now() - started, status });
  return { status, body };
}

// The mix of ordinary requests, repeated in turn by every user.
const ordinary = [
  (u) => call(u, 'GET progress', '/api/progress'),
  (u) => call(u, 'GET meals', '/api/meals').then((r) => { for (const m of r.body?.meals ?? []) if (!String(m.name).startsWith(`u${u.index}-`)) u.foreign++; return r; }),
  async (u) => { const r = await call(u, 'POST meal', '/api/meals', { method: 'POST', body: JSON.stringify({ name: `u${u.index}-meal-${u.created}`, mealType: 'snack', eatenAt: new Date().toISOString() }) }); if (r.status === 201) u.created++; return r; },
  (u) => call(u, 'GET profile', '/api/profile'),
  async (u) => { const r = await call(u, 'POST activity', '/api/activities', { method: 'POST', body: JSON.stringify({ type: 'Walk', occurredAt: new Date().toISOString(), stepCount: 1000 }) }); if (r.status === 201) u.activities++; return r; },
  (u) => call(u, 'GET activities', '/api/activities'),
  (u) => call(u, 'GET rewards', '/api/rewards'),
  (u) => call(u, 'GET meals (other range)', `/api/meals?limit=20`),
];

const intervalMs = 60_000 / PER_MINUTE;
const endAt = Date.now() + MINUTES * 60_000;
console.log(`Running ${USERS} users x ${PER_MINUTE} requests/minute for ${MINUTES} minute(s) against ${API} (database ${dbName})`);
const startedAll = Date.now();
await Promise.all(users.map(async (user) => {
  await new Promise((resolve) => setTimeout(resolve, Math.random() * intervalMs)); // spread the users out
  for (let n = 0; Date.now() < endAt; n++) {
    const next = Date.now() + intervalMs;
    await ordinary[n % ordinary.length](user);
    const wait = next - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }
}));
const elapsed = (Date.now() - startedAll) / 1000;

// Isolation: each user's data must contain only their own records, and every created record must exist exactly once.
let isolationProblems = 0;
const problems = [];
for (const user of users) {
  const meals = await MealEntry.find({ userId: user.id }).lean();
  const activities = await ActivityEntry.countDocuments({ userId: user.id });
  const foreignNames = meals.filter((m) => !m.name.startsWith(`u${user.index}-`)).length;
  if (user.foreign > 0 || foreignNames > 0 || meals.length !== user.created || activities !== user.activities) {
    isolationProblems++;
    problems.push({ user: user.index, seenForeign: user.foreign, foreignStored: foreignNames, mealsStored: meals.length, mealsCreated: user.created, activitiesStored: activities, activitiesCreated: user.activities });
  }
}

const ids = users.map((u) => u.id);
await MealEntry.deleteMany({ userId: { $in: ids } });
await ActivityEntry.deleteMany({ userId: { $in: ids } });
await User.deleteMany({ _id: { $in: ids } });
await mongoose.disconnect();

const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
const q = (p) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] * 10) / 10;
const failures = samples.filter((s) => s.status < 200 || s.status >= 300).length;
const under1s = samples.filter((s) => s.ms <= 1000).length;
const perName = {};
for (const s of samples) (perName[s.name] ??= []).push(s.ms);
const result = {
  durationSeconds: Math.round(elapsed),
  requests: samples.length,
  requestsPerMinutePerUser: Math.round((samples.length / USERS / (elapsed / 60)) * 10) / 10,
  failures,
  failureRate: `${((failures / samples.length) * 100).toFixed(2)}%`,
  statusCodes: samples.reduce((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {}),
  latencyMs: { p50: q(0.5), p95: q(0.95), p99: q(0.99), max: Math.round(sorted.at(-1) ?? 0) },
  under1sShare: `${((under1s / samples.length) * 100).toFixed(2)}%`,
  byRequestP95: Object.fromEntries(Object.entries(perName).map(([name, list]) => { list.sort((a, b) => a - b); return [name, Math.round(list[Math.floor(list.length * 0.95)] ?? 0)]; })),
  isolationProblems,
  ...(problems.length ? { problems } : {}),
};
console.log(JSON.stringify(result, null, 2));
process.exitCode = failures === 0 && isolationProblems === 0 ? 0 : 1;
