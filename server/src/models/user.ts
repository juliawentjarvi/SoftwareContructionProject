import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    timezone: { type: String, required: true, default: 'UTC', maxlength: 100 },
    dailyMealGoal: { type: Number, required: true, default: 3, min: 1, validate: Number.isSafeInteger },
    // Daily step goal; null means not set (so a missing target is never reported as met).
    stepTarget: { type: Number, default: null, min: 1, validate: (value: number | null) => value === null || Number.isSafeInteger(value) },
    notificationsEnabled: { type: Boolean, required: true, default: false },
    passwordResetHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    reminderTimes: {
      type: [String],
      required: true,
      default: ['08:00', '12:30', '18:30'],
      validate: (times: string[]) => times.length >= 1 && times.length <= 12 && times.every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)),
    },
  },
  { timestamps: true },
);

export type UserRecord = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);