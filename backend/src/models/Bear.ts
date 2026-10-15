import mongoose, { Schema, Document, Types } from "mongoose";

export interface IBear extends Document {
  userId: Types.ObjectId;
  name: string;
  energy: number;
  maxEnergy: number;
  createdAt: Date;
  updatedAt: Date;
}

const BearSchema = new Schema<IBear>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 30,
      default: "Teddy"
    },

    energy: {
      type: Number,
      default: 0,
      min: 0
    },

    maxEnergy: {
      type: Number,
      default: 100,
      min: 1
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model<IBear>("Bear", BearSchema);
