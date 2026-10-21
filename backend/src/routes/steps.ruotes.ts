import { Router, Response } from "express";
import { protect, type AuthRequest } from "../middleware/auth";
import { rewardSteps } from "../services/steps.service";

const router = Router();

router.use(protect);

// POST /api/steps
// Submit today's step count and award eligible energy.
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({
        message: "Not authenticated",
      });
      return;
    }

    const { steps } = req.body;

    if (
      !Number.isSafeInteger(steps) ||
      steps < 0 ||
      steps > 100000
    ) {
      res.status(400).json({
        message: "Invalid step count",
      });
      return;
    }

    const result = await rewardSteps(req.userId, steps);

    res.json({
      message: "Steps recorded successfully",
      ...result,
    });
  } catch (error) {
    console.error("Failed to record steps:", error);

    res.status(500).json({
      message: "Failed to record steps",
    });
  }
});

export default router;