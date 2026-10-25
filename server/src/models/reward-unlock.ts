import { Schema, model, type InferSchemaType } from 'mongoose';

// One document per spend. `ref` is the item id for one-time unlocks, or the app-made purchase id for treats, so a repeated
// request finds the same document and never spends twice.
const rewardUnlockSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: String, required: true },
    ref: { type: String, required: true },
    cost: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

rewardUnlockSchema.index({ userId: 1, ref: 1 }, { unique: true });

export type RewardUnlockRecord = InferSchemaType<typeof rewardUnlockSchema>;
export const RewardUnlock = model('RewardUnlock', rewardUnlockSchema);
