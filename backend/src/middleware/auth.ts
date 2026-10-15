import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User";

interface TokenPayload extends JwtPayload {
  userId: string;
}

export interface AuthRequest extends Request {
  userId?: string;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        message: "Not authorized. Token missing."
      });
      return;
    }

    const token = authorization.slice(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }

    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"]
    });

    if (
      typeof decoded === "string" ||
      typeof decoded.userId !== "string" ||
      !mongoose.isValidObjectId(decoded.userId)
    ) {
      res.status(401).json({
        message: "Invalid token"
      });
      return;
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        message: "User no longer exists"
      });
      return;
    }

    req.userId = user.id;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        message: "Invalid or expired token"
      });
      return;
    }

    console.error("Authentication error:", error);
    res.status(500).json({
      message: "Authentication failed"
    });
  }
};
