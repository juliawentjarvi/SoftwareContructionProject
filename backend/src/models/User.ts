import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
	email: string;
	passwordHash: string;
	calibration?: Record<string, any>;
	notificationEnabled: boolean;
	points: number;
	profileImage?: string;
	preferences?: Record<string, any>;
}

const UserSchema: Schema<IUser> = new Schema(
	{
		email: { type: String, required: true, unique: true, lowercase: true, trim: true },
		passwordHash: { type: String, required: true },
		calibration: { type: Schema.Types.Mixed, default: {} },
		notificationEnabled: { type: Boolean, default: true },
		points: { type: Number, default: 0 },
		profileImage: { type: String },
		preferences: { type: Schema.Types.Mixed, default: {} },
	},
	{ timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
