import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error("MONGODB_URI is not defined");
  }

  await mongoose.connect(mongoURI);
  console.log("MongoDB Atlas connected");
};