import { Router, Response } from "express";
import Bear from "../models/Bear";
import { protect, AuthRequest } from "../middleware/auth";

const router = Router();

// All bear routes require authentication
router.use(protect);

// GET /api/bear
// Get the logged-in user's bear
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const bear = await Bear.findOne({
      userId: req.userId
    });

    if (!bear) {
      res.status(404).json({
        message: "Bear not found"
      });
      return;
    }

    res.json({
      bear: {
        id: bear.id,
        name: bear.name,
        energy: bear.energy,
        maxEnergy: bear.maxEnergy
      }
    });
  } catch (error) {
    console.error("Failed to fetch bear:", error);

    res.status(500).json({
      message: "Failed to fetch bear"
    });
  }
});

// PATCH /api/bear/name
// Rename the logged-in user's bear
router.patch("/name", async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;

    if (
      typeof name !== "string" ||
      name.trim().length < 1 ||
      name.trim().length > 30
    ) {
      res.status(400).json({
        message: "Bear name must be 1-30 characters"
      });
      return;
    }

    const bear = await Bear.findOneAndUpdate(
      { userId: req.userId },
      { $set: { name: name.trim() } },
      { new: true, runValidators: true }
    );

    if (!bear) {
      res.status(404).json({
        message: "Bear not found"
      });
      return;
    }

    res.json({
      message: "Bear renamed successfully",
      bear: {
        id: bear.id,
        name: bear.name,
        energy: bear.energy,
        maxEnergy: bear.maxEnergy
      }
    });
  } catch (error) {
    console.error("Failed to rename bear:", error);

    res.status(500).json({
      message: "Failed to rename bear"
    });
  }
});

export default router;
