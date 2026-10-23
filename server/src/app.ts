import bcrypt from 'bcryptjs';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import helmet from 'helmet';
import jwt, { type SignOptions } from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { z } from 'zod';
import { MealEntry } from './models/meal-entry.js';
import { User } from './models/user.js';
import { requireAuth } from './middleware/auth.js';
import { summarizeDailyCounts, dateKeyAt } from './progress.js';
import {
  loginSchema,
  mealCreateSchema,
  mealPatchSchema,
  mealsQuerySchema,
  profilePatchSchema,
  registerSchema,
} from './validation.js';

interface AppOptions {
  jwtSecret: string;
  jwtExpiresIn: string;
  allowedOrigins: string[];
}

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
    notificationsEnabled: user.notificationsEnabled,
    reminderTimes: user.reminderTimes,
    createdAt: user.createdAt,
  };
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
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || options.allowedOrigins.includes(origin)) }));
  app.use(express.json({ limit: '16kb' }));

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
      user: publicUser(user),
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
      const user = await User.findByIdAndDelete(request.auth!.userId, { session });
      if (!user) throw new ApiError(404, 'NOT_FOUND', 'Profile not found');
    });
    response.status(204).end();
  });

  app.use('/api/profile', authenticate);
  app.get('/api/profile', async (request, response) => {
    const user = await User.findById(request.auth!.userId);
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Profile not found');
    response.json({ user: publicUser(user) });
  });
  app.patch('/api/profile', async (request, response) => {
    const changes = validated(profilePatchSchema, request.body);
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

  app.get('/api/progress', authenticate, async (request, response) => {
    const user = await User.findById(request.auth!.userId).select('timezone dailyMealGoal');
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
    response.json({ progress: summarizeDailyCounts(counts, dateKeyAt(new Date(), user.timezone), user.dailyMealGoal) });
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