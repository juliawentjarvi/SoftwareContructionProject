
import { Router, Response } from "express";
import User from "../models/User";
import { protect, type AuthRequest } from "../middleware/auth";

const router = Router();

router.use(protect);

// GET /api/settings
// Load the logged-in user's settings
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select(
      "dailyMealGoal"
    );

    if (!user) {
      res.status(404).json({
        message: "User not found",
      });
      return;
    }

    res.json({
      dailyMealGoal: user.dailyMealGoal,
    });
  } catch (error) {
    console.error("Failed to load settings:", error);
    res.status(500).json({
      message: "Failed to load settings",
    });
  }
});

// PATCH /api/settings
// Save the logged-in user's daily meal goal
router.patch("/", async (req: AuthRequest, res: Response) => {
  try {
    const { dailyMealGoal } = req.body;

    if (
      typeof dailyMealGoal !== "number" ||
      !Number.isInteger(dailyMealGoal) ||
      dailyMealGoal < 1 ||
      dailyMealGoal > 5
    ) {
      res.status(400).json({
        message: "Daily meal goal must be between 1 and 5",
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { dailyMealGoal },
      { new: true, runValidators: true }
    ).select("dailyMealGoal");

    if (!user) {
      res.status(404).json({
        message: "User not found",
      });
      return;
    }

    res.json({
      message: "Daily meal goal updated successfully",
      dailyMealGoal: user.dailyMealGoal,
    });
  } catch (error) {
    console.error("Failed to save settings:", error);
    res.status(500).json({
      message: "Failed to save settings",
    });
  }
});

export default router;
