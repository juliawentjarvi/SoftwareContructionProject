import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { z } from "zod";

const router = express.Router();

const registerSchema = z.object({
	email: z.string().trim().toLowerCase().email(),
	password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
	email: z.string().trim().toLowerCase().email(),
	password: z.string().min(1, "Password is required"),
});

const createToken = (userId: string) => {
	const secret = process.env.JWT_SECRET;
	if (!secret) throw new Error("JWT_SECRET is not defined");

	return jwt.sign({ id: userId }, secret, { expiresIn: "7d" });
};

router.post("/register", async (req, res) => {
	try {
		const parsed = registerSchema.parse(req.body);

		const existing = await User.findOne({ email: parsed.email });
		if (existing) return res.status(409).json({ message: "User already exists" });

		const salt = await bcrypt.genSalt(10);
		const hash = await bcrypt.hash(parsed.password, salt);

		const user = new User({ email: parsed.email, passwordHash: hash });
		await user.save();

		const token = createToken(user._id.toString());

		res.status(201).json({ token, user: { id: user._id, email: user.email } });
	} catch (err) {
		if (err instanceof z.ZodError) {
			return res.status(400).json({ message: err.issues[0]?.message || "Invalid registration details" });
		}
		if (typeof err === "object" && err !== null && "code" in err && err.code === 11000) {
			return res.status(409).json({ message: "An account with this email already exists" });
		}
		console.error(err);
		res.status(500).json({ message: "Server error" });
	}
});

router.post("/login", async (req, res) => {
	try {
		const { email, password } = loginSchema.parse(req.body);

		const user = await User.findOne({ email });
		if (!user) return res.status(401).json({ message: "Invalid credentials" });

		const isMatch = await bcrypt.compare(password, user.passwordHash);
		if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

		const token = createToken(user._id.toString());

		res.json({ token, user: { id: user._id, email: user.email } });
	} catch (err) {
		if (err instanceof z.ZodError) {
			return res.status(400).json({ message: err.issues[0]?.message || "Invalid login details" });
		}
		console.error(err);
		res.status(500).json({ message: "Server error" });
	}
});

export default router;
