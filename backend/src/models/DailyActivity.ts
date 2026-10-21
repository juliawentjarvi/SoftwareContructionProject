
import mongoose, { Schema, Document } from "mongoose";

export interface IDailyActivity extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  mealsRewarded: number;
  stepsRewarded: number;
}

const dailyActivitySchema = new Schema<IDailyActivity>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    mealsRewarded: {
      type: Number,
      default: 0,
      min: 0,
    },
    stepsRewarded: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// One activity record per user per UTC day.
dailyActivitySchema.index(
  { userId: 1, date: 1 },
  { unique: true }
);

export default mongoose.models.DailyActivity ||
  mongoose.model<IDailyActivity>(
    "DailyActivity",
    dailyActivitySchema
  );
