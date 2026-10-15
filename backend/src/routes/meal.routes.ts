import { Router, Response } from "express";
import mongoose from "mongoose";
import Meal, { type MealType } from "../models/Meal";
import { protect, type AuthRequest } from "../middleware/auth";

const router = Router();

router.use(protect);

// GET /api/meals
// Get all meals belonging to the logged-in user
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const meals = await Meal.find({
      userId: req.userId
    }).sort({ eatenAt: -1 });

    res.json({ meals });
  } catch (error) {
    console.error("Failed to fetch meals:", error);
    res.status(500).json({
      message: "Failed to fetch meals"
    });
  }
});

// POST /api/meals
// Add a new meal
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, notes, eatenAt } = req.body;

    const validTypes: MealType[] = [
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "other"
        ];

        const isMealType = (value: unknown): value is MealType => {
        return (
            typeof value === "string" &&
            validTypes.some((validType) => validType === value)
        );
        };

    if (
      typeof name !== "string" ||
      name.trim().length < 1 ||
      name.trim().length > 100 ||
      !isMealType(type) ||
      (notes !== undefined &&
        (typeof notes !== "string" || notes.length > 500))
    ) {
      res.status(400).json({
        message: "Invalid meal information"
      });
      return;
    }

    let mealDate = new Date();

    if (eatenAt !== undefined) {
      if (typeof eatenAt !== "string") {
        res.status(400).json({
          message: "Invalid meal date"
        });
        return;
      }

      mealDate = new Date(eatenAt);

      if (Number.isNaN(mealDate.getTime())) {
        res.status(400).json({
          message: "Invalid meal date"
        });
        return;
      }
    }

    const meal = await Meal.create({
      userId: req.userId,
      name: name.trim(),
      type,
      notes: notes?.trim(),
      eatenAt: mealDate,
      energyAwarded: 0
    });

    res.status(201).json({
      message: "Meal logged successfully",
      meal
    });
  } catch (error) {
    console.error("Failed to log meal:", error);
    res.status(500).json({
      message: "Failed to log meal"
    });
  }
});

// DELETE /api/meals/:id
// Delete one of the logged-in user's meals
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const mealId = req.params.id;

    if (
      typeof mealId !== "string" ||
      !mongoose.isValidObjectId(mealId)
    ) {
      res.status(400).json({
        message: "Invalid meal ID"
      });
      return;
    }

    const meal = await Meal.findOneAndDelete({
      _id: mealId,
      userId: req.userId
    });

    if (!meal) {
      res.status(404).json({
        message: "Meal not found"
      });
      return;
    }

    res.json({
      message: "Meal deleted successfully"
    });
  } catch (error) {
    console.error("Failed to delete meal:", error);
    res.status(500).json({
      message: "Failed to delete meal"
    });
  }
});

export default router;
