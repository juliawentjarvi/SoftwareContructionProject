import express from "express";
import Meal from "../models/Meal";
import { authMiddleware } from "../middleware/auth";

const router = express.Router();

router.use(authMiddleware as any);

router.post("/", async (req, res) => {
	try {
		const { name, notes, eatenAt } = req.body;
		const meal = new Meal({
			user: (req as any).user._id,
			name,
			notes,
			eatenAt: eatenAt ? new Date(eatenAt) : new Date(),
		});

		await meal.save();
		res.status(201).json(meal);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Server error" });
	}
});

router.get("/", async (req, res) => {
	try {
		const meals = await Meal.find({ user: (req as any).user._id }).sort({ eatenAt: -1 });
		res.json(meals);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Server error" });
	}
});

export default router;
