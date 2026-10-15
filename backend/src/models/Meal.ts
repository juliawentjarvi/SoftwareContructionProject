import mongoose, { Schema, Document } from "mongoose";

export interface IMeal extends Document {
	user: mongoose.Types.ObjectId;
	name: string;
	notes?: string;
	eatenAt: Date;
}

const MealSchema: Schema<IMeal> = new Schema(
	{
		user: { type: Schema.Types.ObjectId, ref: "User", required: true },
		name: { type: String, required: true },
		notes: { type: String },
		eatenAt: { type: Date, default: Date.now },
	},
	{ timestamps: true }
);

export default mongoose.model<IMeal>("Meal", MealSchema);
