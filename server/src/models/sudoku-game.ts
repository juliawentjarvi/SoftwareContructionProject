import { Schema, model, type InferSchemaType } from 'mongoose';

// One document per game. `clientId` is made by the app when a game starts, so repeating the start (a retry after a lost
// response, or resuming) finds the same document and never charges energy or awards points a second time.
const sudokuGameSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clientId: { type: String, required: true, minlength: 36, maxlength: 36 },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    rewardPoints: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

sudokuGameSchema.index({ userId: 1, clientId: 1 }, { unique: true });
sudokuGameSchema.index({ userId: 1, startedAt: -1 });

export type SudokuGameRecord = InferSchemaType<typeof sudokuGameSchema>;
export const SudokuGame = model('SudokuGame', sudokuGameSchema);
