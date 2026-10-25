import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import helmet from 'helmet';
import jwt, { type SignOptions } from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { z } from 'zod';
import { ActivityEntry } from './models/activity-entry.js';
import { MealEntry } from './models/meal-entry.js';
import { SudokuGame } from './models/sudoku-game.js';
import { RewardUnlock } from './models/reward-unlock.js';
import { CATALOG, DEFAULT_THEME, REWARD_PER_SUDOKU_GAME, findItem } from './rewards.js';
import { reconcileReminderTimes, reminderCountFor } from './reminder-schedule.js';
import { User } from './models/user.js';
import { requireAuth } from './middleware/auth.js';
import { summarizeDailyCounts, dateKeyAt } from './progress.js';
import {
  activityCreateSchema,
  activityPatchSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  mealCreateSchema,
  mealPatchSchema,
  mealsQuerySchema,
  profilePatchSchema,
  profilePictureSchema,
  registerSchema,
  sudokuStartSchema,
  unlockSchema,
} from './validation.js';

interface AppOptions {
  jwtSecret: string;
  jwtExpiresIn: string;
  allowedOrigins: string[];
  /** Development only: also accept browsers loaded from any host's Expo web dev server (port 8081/19006), so the web app works from another device on the network. */
  allowDevOrigins?: boolean;
  /** Delivers a password-reset code to an account's email. Never called for unknown emails. */
  sendPasswordReset?: (email: string, token: string) => Promise<void>;
  /** Password reset is postponed; its routes only exist when this is true. */
  passwordResetEnabled?: boolean;
}

const RESET_TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

const DEV_WEB_ORIGIN = /^https?:\/\/[^/]+:(8081|19006)$/;

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

function validated<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, 'INVALID_REQUEST', result.error.issues.map((issue) => issue.message).join('; '));
  }
  return result.data;
}

function publicUser(user: InstanceType<typeof User>) {
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    timezone: user.timezone,
    dailyMealGoal: user.dailyMealGoal,
    stepTarget: user.stepTarget ?? null,
    hasProfilePicture: user.hasPicture === true,
    selectedTheme: user.selectedTheme ?? DEFAULT_THEME,
    selectedAccessory: user.selectedAccessory ?? null,
    notificationsEnabled: user.notificationsEnabled,
    reminderTimes: user.reminderTimes,
    createdAt: user.createdAt,
  };
}

/** Accounts created before reminders followed the meal target may have a schedule of the wrong length; fix it when read. */
async function withMatchingReminders(user: InstanceType<typeof User>) {
  if (user.reminderTimes.length !== reminderCountFor(user.dailyMealGoal)) {
    user.reminderTimes = reconcileReminderTimes(user.reminderTimes, user.reminderTimes.length, user.dailyMealGoal);
    await user.save();
  }
  return user;
}

/** Reward balance: points earned from completed games minus points spent on unlocks and treats. Never negative. */
async function rewardBalance(userId: Types.ObjectId, session?: mongoose.ClientSession) {
  const [earned] = await SudokuGame.aggregate<{ points: number }>([
    { $match: { userId } },
    { $group: { _id: null, points: { $sum: '$rewardPoints' } } },
  ]).session(session ?? null);
  const [spent] = await RewardUnlock.aggregate<{ points: number }>([
    { $match: { userId } },
    { $group: { _id: null, points: { $sum: '$cost' } } },
  ]).session(session ?? null);
  return { earned: earned?.points ?? 0, spent: spent?.points ?? 0, points: (earned?.points ?? 0) - (spent?.points ?? 0) };
}

async function unlockedIds(userId: Types.ObjectId): Promise<string[]> {
  const rows = await RewardUnlock.find({ userId }).lean();
  const ids = new Set<string>([DEFAULT_THEME]);
  for (const row of rows) if (findItem(row.itemId)?.kind !== 'treat') ids.add(row.itemId);
  return [...ids];
}

function bearerToken(userId: string, secret: string, expiresIn: string): string {
  return jwt.sign({}, secret, { subject: userId, expiresIn: expiresIn as NonNullable<SignOptions['expiresIn']> });
}

function requireObjectId(value: string): Types.ObjectId {
  if (!mongoose.isValidObjectId(value)) throw new ApiError(400, 'INVALID_ID', 'The requested id is invalid');
  return new Types.ObjectId(value);
}

export function createApp(options: AppOptions) {
  const app = express();
  const authenticate = requireAuth(options.jwtSecret);
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || options.allowedOrigins.includes(origin) || (options.allowDevOrigins === true && DEV_WEB_ORIGIN.test(origin))),
  }));
  // Bodies are small everywhere, except the profile picture upload, which has its own larger (but still bounded) limit.
  const smallJson = express.json({ limit: '16kb' });
  const pictureJson = express.json({ limit: '200kb' });
  app.use((request, response, next) => (request.path === '/api/profile/picture' && request.method === 'PUT' ? pictureJson : smallJson)(request, response, next));

  app.get('/health', (_request, response) => response.json({ status: 'ok' }));

  app.post('/api/auth/register', authLimiter, async (request, response) => {
    const input = validated(registerSchema, request.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.create({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      timezone: input.timezone ?? 'UTC',
    });
    response.status(201).json({
      user: publicUser(user),
      accessToken: bearerToken(user._id.toString(), options.jwtSecret, options.jwtExpiresIn),
      tokenType: 'Bearer',
    });
  });

  app.post('/api/auth/login', authLimiter, async (request, response) => {
    const input = validated(loginSchema, request.body);
    const user = await User.findOne({ email: input.email }).select('+passwordHash');
    const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !passwordMatches) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

    response.json({
      user: publicUser(await withMatchingReminders(user)),
      accessToken: bearerToken(user._id.toString(), options.jwtSecret, options.jwtExpiresIn),
      tokenType: 'Bearer',
    });
  });

  // The response never reveals whether the email belongs to an account, and the code is only ever sent to that email.
  if (options.passwordResetEnabled) app.post('/api/auth/password-reset/request', authLimiter, async (request, response) => {
    const { email } = validated(passwordResetRequestSchema, request.body);
    const token = randomBytes(32).toString('base64url');
    const user = await User.findOneAndUpdate(
      { email },
      { passwordResetHash: hashResetToken(token), passwordResetExpires: new Date(Date.now() + RESET_TOKEN_LIFETIME_MS) },
    );
    if (user && options.sendPasswordReset) {
      // Not awaited so response time does not depend on whether an account exists.
      void options.sendPasswordReset(email, token).catch((error: unknown) => console.error('Password reset message could not be delivered:', error instanceof Error ? error.message : 'unknown error'));
    }
    response.status(202).json({ message: 'If an account exists for that email, a reset code has been sent.' });
  });

  if (options.passwordResetEnabled) app.post('/api/auth/password-reset/confirm', authLimiter, async (request, response) => {
    const { token, password } = validated(passwordResetConfirmSchema, request.body);
    const passwordHash = await bcrypt.hash(password, 12);
    // Atomic: the matching, unexpired token is consumed by exactly one request.
    const user = await User.findOneAndUpdate(
      { passwordResetHash: hashResetToken(token), passwordResetExpires: { $gt: new Date() } },
      { passwordHash, $unset: { passwordResetHash: '', passwordResetExpires: '' } },
    );
    if (!user) throw new ApiError(400, 'INVALID_RESET_TOKEN', 'This reset code is invalid or has expired');
    response.status(204).end();
  });

  // Called each time the app opens with a stored sign-in: confirms the account still exists and hands back a fresh token,
  // so a session stays alive for as long as the app keeps being used.
  app.post('/api/auth/refresh', authenticate, async (request, response) => {
    const user = await User.findById(request.auth!.userId);
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'The account for this token no longer exists');
    response.json({
      user: publicUser(await withMatchingReminders(user)),
      accessToken: bearerToken(user._id.toString(), options.jwtSecret, options.jwtExpiresIn),
      tokenType: 'Bearer',
    });
  });

  app.get('/api/auth/me', authenticate, async (request, response) => {
    const user = await User.findById(request.auth!.userId);
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'The account for this token no longer exists');
    response.json({ user: publicUser(user) });
  });

  app.delete('/api/auth/me', authenticate, async (request, response) => {
    await mongoose.connection.transaction(async (session) => {
      await MealEntry.deleteMany({ userId: request.auth!.userId }, { session });
      await ActivityEntry.deleteMany({ userId: request.auth!.userId }, { session });
      await SudokuGame.deleteMany({ userId: request.auth!.userId }, { session });
      await RewardUnlock.deleteMany({ userId: request.auth!.userId }, { session });
      const user = await User.findByIdAndDelete(request.auth!.userId, { session });
      if (!user) throw new ApiError(404, 'NOT_FOUND', 'Profile not found');
    });
    response.status(204).end();
  });

  app.use('/api/profile', authenticate);
  app.get('/api/profile/picture', async (request, response) => {
    const user = await User.findById(request.auth!.userId).select('+profilePicture');
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Profile not found');
    response.json({ image: user.profilePicture ?? null });
  });
  app.put('/api/profile/picture', async (request, response) => {
    const { image } = validated(profilePictureSchema, request.body);
    const user = await User.findByIdAndUpdate(request.auth!.userId, { profilePicture: image, hasPicture: true }, { new: true });
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Profile not found');
    response.json({ user: publicUser(user) });
  });
  app.delete('/api/profile/picture', async (request, response) => {
    const user = await User.findByIdAndUpdate(request.auth!.userId, { profilePicture: null, hasPicture: false });
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Profile not found');
    response.status(204).end();
  });
  app.get('/api/profile', async (request, response) => {
    const user = await User.findById(request.auth!.userId);
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Profile not found');
    response.json({ user: publicUser(await withMatchingReminders(user)) });
  });
  app.patch('/api/profile', async (request, response) => {
    const changes = validated(profilePatchSchema, request.body);
    const current = await User.findById(request.auth!.userId);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Profile not found');

    // One reminder per planned meal: the schedule always has min(meal target, 12) times.
    const goal = changes.dailyMealGoal ?? current.dailyMealGoal;
    if (changes.reminderTimes) {
      if (changes.reminderTimes.length !== reminderCountFor(goal)) {
        throw new ApiError(400, 'INVALID_REQUEST', `Reminders must match the meal target: ${reminderCountFor(goal)} time(s)`);
      }
    } else if (changes.dailyMealGoal !== undefined || current.reminderTimes.length !== reminderCountFor(current.dailyMealGoal)) {
      changes.reminderTimes = reconcileReminderTimes(current.reminderTimes, current.dailyMealGoal, goal);
    }
    // A theme or appearance option can only be chosen once it is unlocked (the default theme always is).
    const unlocked = changes.selectedTheme !== undefined || changes.selectedAccessory !== undefined
      ? await unlockedIds(new Types.ObjectId(request.auth!.userId))
      : [];
    const choose = (id: string | null | undefined, kind: 'theme' | 'appearance') => {
      if (id === null || id === undefined) return;
      if (findItem(id)?.kind !== kind) throw new ApiError(400, 'INVALID_REQUEST', `Unknown ${kind} option`);
      if (!unlocked.includes(id)) throw new ApiError(409, 'NOT_UNLOCKED', 'Unlock this item with reward points first');
    };
    choose(changes.selectedTheme, 'theme');
    choose(changes.selectedAccessory, 'appearance');
    if (changes.selectedTheme === null) changes.selectedTheme = DEFAULT_THEME;

    const user = await User.findByIdAndUpdate(request.auth!.userId, changes, { new: true, runValidators: true });
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Profile not found');
    response.json({ user: publicUser(user) });
  });

  app.use('/api/meals', authenticate);
  app.get('/api/meals', async (request, response) => {
    const query = validated(mealsQuerySchema, request.query);
    const filter: Record<string, unknown> = { userId: request.auth!.userId };
    if (query.from || query.to) {
      filter.eatenAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }
    const meals = await MealEntry.find(filter).sort({ eatenAt: -1, _id: -1 }).limit(query.limit).lean();
    response.json({ meals });
  });
  app.post('/api/meals', async (request, response) => {
    const input = validated(mealCreateSchema, request.body);
    const meal = await MealEntry.create({ ...input, userId: request.auth!.userId });
    response.status(201).json({ meal });
  });
  app.get('/api/meals/:mealId', async (request, response) => {
    const mealId = requireObjectId(request.params.mealId!);
    const meal = await MealEntry.findOne({ _id: mealId, userId: request.auth!.userId }).lean();
    if (!meal) throw new ApiError(404, 'NOT_FOUND', 'Meal entry not found');
    response.json({ meal });
  });
  app.patch('/api/meals/:mealId', async (request, response) => {
    const mealId = requireObjectId(request.params.mealId!);
    const changes = validated(mealPatchSchema, request.body);
    const meal = await MealEntry.findOneAndUpdate(
      { _id: mealId, userId: request.auth!.userId },
      changes,
      { new: true, runValidators: true },
    ).lean();
    if (!meal) throw new ApiError(404, 'NOT_FOUND', 'Meal entry not found');
    response.json({ meal });
  });
  app.delete('/api/meals/:mealId', async (request, response) => {
    const mealId = requireObjectId(request.params.mealId!);
    const meal = await MealEntry.findOneAndDelete({ _id: mealId, userId: request.auth!.userId });
    if (!meal) throw new ApiError(404, 'NOT_FOUND', 'Meal entry not found');
    response.status(204).end();
  });

  app.use('/api/activities', authenticate);
  app.get('/api/activities', async (request, response) => {
    const query = validated(mealsQuerySchema, request.query);
    const filter: Record<string, unknown> = { userId: request.auth!.userId };
    if (query.from || query.to) {
      filter.occurredAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }
    const activities = await ActivityEntry.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(query.limit).lean();
    response.json({ activities });
  });
  app.post('/api/activities', async (request, response) => {
    const input = validated(activityCreateSchema, request.body);
    const activity = await ActivityEntry.create({ ...input, userId: request.auth!.userId });
    response.status(201).json({ activity });
  });
  app.patch('/api/activities/:activityId', async (request, response) => {
    const activityId = requireObjectId(request.params.activityId!);
    const changes = validated(activityPatchSchema, request.body);
    const { stepCount, ...rest } = changes;
    const update: Record<string, unknown> = { ...rest };
    if (stepCount === null) update.$unset = { stepCount: '' };
    else if (stepCount !== undefined) update.stepCount = stepCount;
    const activity = await ActivityEntry.findOneAndUpdate(
      { _id: activityId, userId: request.auth!.userId },
      update,
      { new: true, runValidators: true },
    ).lean();
    if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Activity entry not found');
    response.json({ activity });
  });
  app.delete('/api/activities/:activityId', async (request, response) => {
    const activityId = requireObjectId(request.params.activityId!);
    const activity = await ActivityEntry.findOneAndDelete({ _id: activityId, userId: request.auth!.userId });
    if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Activity entry not found');
    response.status(204).end();
  });

  // Sudoku: starting a game costs 5 energy (counted from the game's start time) and completing it earns reward points.
  // Both happen at most once per game id, so retries and resuming are safe.
  app.post('/api/sudoku/games', authenticate, async (request, response) => {
    const { gameId } = validated(sudokuStartSchema, request.body);
    const userId = new Types.ObjectId(request.auth!.userId);
    const existing = await SudokuGame.findOne({ userId, clientId: gameId }).lean();
    if (existing) {
      response.status(200).json({ game: existing });
      return;
    }
    try {
      const created = await SudokuGame.create({ userId, clientId: gameId });
      response.status(201).json({ game: created });
    } catch (error) {
      // A concurrent identical start won the race: return its game instead of failing.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        response.status(200).json({ game: await SudokuGame.findOne({ userId, clientId: gameId }).lean() });
        return;
      }
      throw error;
    }
  });

  app.post('/api/sudoku/games/:gameId/complete', authenticate, async (request, response) => {
    const gameId = validated(sudokuStartSchema, { gameId: request.params.gameId }).gameId;
    const userId = new Types.ObjectId(request.auth!.userId);
    // Atomic: only the first completion matches, so the reward is awarded once.
    const first = await SudokuGame.findOneAndUpdate(
      { userId, clientId: gameId, completedAt: { $exists: false } },
      { completedAt: new Date(), rewardPoints: REWARD_PER_SUDOKU_GAME },
      { new: true },
    ).lean();
    if (!first && !(await SudokuGame.exists({ userId, clientId: gameId }))) throw new ApiError(404, 'NOT_FOUND', 'Game not found');
    response.json({ rewardPointsAwarded: first ? REWARD_PER_SUDOKU_GAME : 0, points: (await rewardBalance(userId)).points });
  });

  app.get('/api/rewards', authenticate, async (request, response) => {
    const userId = new Types.ObjectId(request.auth!.userId);
    const [balance, unlocked, treatRows] = await Promise.all([
      rewardBalance(userId),
      unlockedIds(userId),
      RewardUnlock.aggregate<{ _id: string; count: number }>([{ $match: { userId } }, { $group: { _id: '$itemId', count: { $sum: 1 } } }]),
    ]);
    const treats = Object.fromEntries(treatRows.filter((row) => findItem(row._id)?.kind === 'treat').map((row) => [row._id, row.count]));
    response.json({ ...balance, unlocked, treats, catalog: CATALOG });
  });

  // Spend reward points. One-time items (appearance, themes) are keyed by item id; treats by an app-made purchase id, so a
  // repeated request is recognised and never spends twice. The balance can never go below zero.
  app.post('/api/rewards/unlock', authenticate, async (request, response) => {
    const { itemId, purchaseId } = validated(unlockSchema, request.body);
    const item = findItem(itemId)!;
    if (item.kind === 'treat' && !purchaseId) throw new ApiError(400, 'INVALID_REQUEST', 'A treat purchase needs a purchase id');
    const userId = new Types.ObjectId(request.auth!.userId);
    const ref = item.kind === 'treat' ? purchaseId! : itemId;

    if (item.cost === 0 || (await RewardUnlock.exists({ userId, ref }))) {
      response.status(200).json({ ...(await rewardBalance(userId)), unlocked: await unlockedIds(userId) });
      return;
    }
    try {
      await mongoose.connection.transaction(async (session) => {
        const { points } = await rewardBalance(userId, session);
        if (points < item.cost) throw new ApiError(409, 'INSUFFICIENT_POINTS', 'Not enough reward points yet');
        await RewardUnlock.create([{ userId, itemId, ref, cost: item.cost }], { session });
        await User.updateOne({ _id: userId }, { $inc: { spendVersion: 1 } }, { session });
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        response.status(200).json({ ...(await rewardBalance(userId)), unlocked: await unlockedIds(userId) });
        return;
      }
      throw error;
    }
    response.status(201).json({ ...(await rewardBalance(userId)), unlocked: await unlockedIds(userId) });
  });

  app.get('/api/progress', authenticate, async (request, response) => {
    const user = await User.findById(request.auth!.userId).select('timezone dailyMealGoal stepTarget createdAt');
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Profile not found');

    const days = await MealEntry.aggregate<{ _id: string; mealCount: number }>([
      { $match: { userId: new Types.ObjectId(request.auth!.userId) } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$eatenAt', timezone: user.timezone } },
          mealCount: { $sum: 1 },
        },
      },
    ]);
    const counts = new Map(days.map(({ _id, mealCount }) => [_id, mealCount]));

    // Steps per local day; days without any step entry stay absent so "missing" is never shown as zero.
    const stepDays = await ActivityEntry.aggregate<{ _id: string; steps: number }>([
      { $match: { userId: new Types.ObjectId(request.auth!.userId), stepCount: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt', timezone: user.timezone } },
          steps: { $sum: '$stepCount' },
        },
      },
    ]);
    const stepsByDay = new Map(stepDays.map(({ _id, steps }) => [_id, steps]));

    // Sudoku games started per local day; each costs energy once.
    const sudokuDays = await SudokuGame.aggregate<{ _id: string; starts: number }>([
      { $match: { userId: new Types.ObjectId(request.auth!.userId) } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt', timezone: user.timezone } }, starts: { $sum: 1 } } },
    ]);
    const sudokuStartsByDay = new Map(sudokuDays.map(({ _id, starts }) => [_id, starts]));
    response.json({
      progress: summarizeDailyCounts(counts, dateKeyAt(new Date(), user.timezone), user.dailyMealGoal, { stepsByDay, sudokuStartsByDay, stepTarget: user.stepTarget ?? null, accountStart: dateKeyAt(user.createdAt, user.timezone) }),
    });
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _request: Request, response: Response, _next) => {
    if (error instanceof ApiError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
      response.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'The submitted data is invalid' } });
      return;
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      response.status(409).json({ error: { code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists' } });
      return;
    }
    if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
      response.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large' } });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } });
      return;
    }
    console.error(error);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  };
  app.use(errorHandler);

  return app;
}