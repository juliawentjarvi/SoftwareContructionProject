
import { Router, Response } from "express";
import Bear from "../models/Bear";
import { protect, type AuthRequest } from "../middleware/auth";

const router = Router();

router.use(protect);

const SUDOKU_COST = 5;

// POST /api/sudoku/start
// Spend 5 energy to start a Sudoku game.
router.post("/start", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({
        message: "Not authenticated"
      });
      return;
    }

    // Atomic update: only deduct energy if at least 5 remains.
    const bear = await Bear.findOneAndUpdate(
      {
        userId: req.userId,
        energy: { $gte: SUDOKU_COST }
      },
      {
        $inc: { energy: -SUDOKU_COST }
      },
      {
        new: true
      }
    );

    if (!bear) {
      const existingBear = await Bear.findOne({
        userId: req.userId
      });

      if (!existingBear) {
        res.status(404).json({
          message: "Bear not found"
        });
        return;
      }

      res.status(403).json({
        message: "Not enough energy to play Sudoku",
        requiredEnergy: SUDOKU_COST,
        currentEnergy: existingBear.energy
      });
      return;
    }

    res.json({
      message: "Sudoku game started!",
      energySpent: SUDOKU_COST,
      totalEnergy: bear.energy
    });
  } catch (error) {
    console.error("Failed to start Sudoku:", error);

    res.status(500).json({
      message: "Could not start Sudoku"
    });
  }
});

export default router;
