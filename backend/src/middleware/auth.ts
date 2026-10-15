import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

declare global {
	namespace Express {
		interface Request {
			user?: any;
		}
	}
}

export const authMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const authHeader = req.header("Authorization");

	if (!authHeader) {
		return res.status(401).json({ message: "No token provided" });
	}

	const token = authHeader.replace("Bearer ", "");

	try {
		const payload: any = jwt.verify(token, process.env.JWT_SECRET || "secret");
		const user = await User.findById(payload.id).select("-passwordHash");

		if (!user) {
			return res.status(401).json({ message: "Invalid token" });
		}

		req.user = user;
		next();
	} catch (err) {
		return res.status(401).json({ message: "Invalid token" });
	}
};

export default authMiddleware;
