import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    timezone: { type: String, required: true, default: 'UTC', maxlength: 100 },
    dailyMealGoal: { type: Number, required: true, default: 3, min: 1, validate: Number.isSafeInteger },
    notificationsEnabled: { type: Boolean, required: true, default: false },
    passwordResetHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    reminderTimes: {
      type: [String],
      required: true,
      default: ['09:00', '13:00', '19:00'],
      validate: (times: string[]) => times.length >= 1 && times.length <= 8 && times.every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)),
    },
  },
  { timestamps: true },
);

export type UserRecord = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);