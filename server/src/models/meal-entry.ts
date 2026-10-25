import { Schema, model, type InferSchemaType } from 'mongoose';

const mealEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], required: true },
    eatenAt: { type: Date, required: true },
    // Version of each field, raised whenever it changes; used to detect stale edits (see concurrency.ts).
    fieldVersions: { type: Map, of: Number, default: {} },
    notes: { type: String, trim: true, maxlength: 280, default: null },
  },
  { timestamps: true },
);

mealEntrySchema.index({ userId: 1, eatenAt: -1 });

export type MealEntryRecord = InferSchemaType<typeof mealEntrySchema>;
export const MealEntry = model('MealEntry', mealEntrySchema);