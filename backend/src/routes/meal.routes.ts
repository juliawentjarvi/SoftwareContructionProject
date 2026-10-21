import { Router, Response } from "express";
import mongoose from "mongoose";
import Meal, { type MealType } from "../models/Meal";
import { protect, type AuthRequest } from "../middleware/auth";
import { logMealWithEnergy } from "../services/energy.service";
import Bear from "../models/Bear";
import DailyActivity from "../models/DailyActivity";

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

    
    if (!req.userId) {
      res.status(401).json({
        message: "Not authenticated"
      });
      return;
    }

    const meal = await logMealWithEnergy({
      userId: req.userId,
      name: name.trim(),
      type,
      notes: notes?.trim(),
      eatenAt: mealDate
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

// DELETE /api/meals/:id
// Delete a meal and reverse its energy reward
router.delete("/:id", async (req: AuthRequest, res: Response) => {
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

  if (!req.userId) {
    res.status(401).json({
      message: "Not authenticated"
    });
    return;
  }

  const session = await mongoose.startSession();

  try {
    let deleted = false;
    let energyRemoved = 0;
    let totalEnergy = 0;

    await session.withTransaction(async () => {
      const meal = await Meal.findOne({
        _id: mealId,
        userId: req.userId
      }).session(session);

      if (!meal) {
        return;
      }

      const bear = await Bear.findOne({
        userId: req.userId
      }).session(session);

      if (!bear) {
        throw new Error("Bear not found");
      }

      const mealEnergy = Math.max(
        0,
        meal.energyAwarded ?? 0
      );

      energyRemoved = Math.min(
        mealEnergy,
        bear.energy
      );

      bear.energy = Math.max(
        0,
        bear.energy - energyRemoved
      );

      await bear.save({ session });

      // Only adjust today's meal reward counter.
      const now = new Date();

      const dayStart = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate()
        )
      );

      const dayEnd = new Date(
        dayStart.getTime() + 24 * 60 * 60 * 1000
      );

      if (
        mealEnergy > 0 &&
        meal.eatenAt >= dayStart &&
        meal.eatenAt < dayEnd
      ) {
        await DailyActivity.updateOne(
          {
            userId: req.userId,
            date: dayStart,
            mealsRewarded: { $gt: 0 }
          },
          {
            $inc: { mealsRewarded: -1 }
          },
          { session }
        );
      }

      await Meal.deleteOne(
        {
          _id: mealId,
          userId: req.userId
        },
        { session }
      );

      deleted = true;
      totalEnergy = bear.energy;
    });

    if (!deleted) {
      res.status(404).json({
        message: "Meal not found"
      });
      return;
    }

    res.json({
      message: "Meal deleted successfully",
      energyRemoved,
      totalEnergy
    });
  } catch (error) {
    console.error("Failed to delete meal:", error);

    res.status(500).json({
      message: "Failed to delete meal"
    });
  } finally {
    await session.endSession();
  }
});


export default router;
