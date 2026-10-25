import { Schema, model, type InferSchemaType } from 'mongoose';

const activityEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    occurredAt: { type: Date, required: true },
    // Absent means "no step information"; 0 is a real value.
    stepCount: { type: Number, min: 0, max: 1_000_000, validate: Number.isInteger },
    // Version of each field, raised whenever it changes; used to detect stale edits (see concurrency.ts).
    fieldVersions: { type: Map, of: Number, default: {} },
    notes: { type: String, trim: true, maxlength: 280, default: null },
  },
  { timestamps: true },
);

activityEntrySchema.index({ userId: 1, occurredAt: -1 });

export type ActivityEntryRecord = InferSchemaType<typeof activityEntrySchema>;
export const ActivityEntry = model('ActivityEntry', activityEntrySchema);
