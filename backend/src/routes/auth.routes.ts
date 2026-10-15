import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import Bear from "../models/Bear";

const router = Router();

const createToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ userId }, secret, {
    expiresIn: "7d"
  });
};

// REGISTER
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      username.trim().length < 3 ||
      username.trim().length > 30 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 ||
      password.length > 72
    ) {
      res.status(400).json({
        message: "Invalid registration details"
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      res.status(409).json({
        message: "Email already registered"
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      dailyMealGoal: 3
    });

    // Create the user's bear
    try {
      await Bear.create({
        userId: user._id,
        name: "Teddy",
        energy: 0,
        maxEnergy: 100
      });
    } catch (error) {
      // Roll back account creation if bear creation fails
      await User.findByIdAndDelete(user._id);
      throw error;
    }

    const token = createToken(user.id);

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        dailyMealGoal: user.dailyMealGoal
      }
    });
  } catch (error) {
    console.error("Registration failed:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        message: "Account already exists"
      });
      return;
    }

    res.status(500).json({
      message: "Registration failed"
    });
  }
});

// LOGIN
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      res.status(400).json({
        message: "Email and password are required"
      });
      return;
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select("+password");

    if (!user) {
      res.status(401).json({
        message: "Invalid email or password"
      });
      return;
    }

    const isValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isValid) {
      res.status(401).json({
        message: "Invalid email or password"
      });
      return;
    }

    const token = createToken(user.id);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        dailyMealGoal: user.dailyMealGoal
      }
    });
  } catch (error) {
    console.error("Login failed:", error);

    res.status(500).json({
      message: "Login failed"
    });
  }
});

export default router;
