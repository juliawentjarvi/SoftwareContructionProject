import mongoose, { Schema, Document, Types } from "mongoose";

export type MealType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "other";

export interface IMeal extends Document {
  userId: Types.ObjectId;
  name: string;
  type: MealType;
  eatenAt: Date;
  notes?: string;
  energyAwarded: number;
  createdAt: Date;
  updatedAt: Date;
}

const MealSchema = new Schema<IMeal>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    type: {
      type: String,
      enum: [
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "other"
      ],
      required: true
    },

    eatenAt: {
      type: Date,
      required: true,
      default: Date.now
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500
    },

    energyAwarded: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

MealSchema.index({ userId: 1, eatenAt: -1 });

export default mongoose.model<IMeal>("Meal", MealSchema);
