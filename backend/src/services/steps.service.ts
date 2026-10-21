
import mongoose from "mongoose";
import Bear from "../models/Bear";
import DailyActivity from "../models/DailyActivity";
import { DateTime } from "luxon";

const STEPS_PER_REWARD = 1000;
const ENERGY_PER_REWARD = 5;
const MAX_REWARDED_STEPS = 5000;

export async function rewardSteps(
  userId: string,
  reportedSteps: number
) {
  if (
    !Number.isSafeInteger(reportedSteps) ||
    reportedSteps < 0 ||
    reportedSteps > 100000
  ) {
    throw new Error("Invalid step count");
  }

  const session = await mongoose.startSession();

  try {
    let result = {
      stepsToday: reportedSteps,
      stepsRewarded: 0,
      energyAwarded: 0,
      totalEnergy: 0,
    };

    await session.withTransaction(async () => {
      // Determine today's date in Finland.
      // Europe/Helsinki automatically handles daylight saving time.
      const todayInFinland = DateTime.now().setZone(
        "Europe/Helsinki"
      );

      // Store the Finland calendar date as a UTC date key.
      // For example, October 21 becomes 2026-10-21T00:00:00Z.
      const dayStart = new Date(
        Date.UTC(
          todayInFinland.year,
          todayInFinland.month - 1,
          todayInFinland.day
        )
      );

      const eligibleSteps =
        Math.min(
          Math.floor(reportedSteps / STEPS_PER_REWARD) *
            STEPS_PER_REWARD,
          MAX_REWARDED_STEPS
        );

      const activity = await DailyActivity.findOneAndUpdate(
        { userId, date: dayStart },
        {
          $setOnInsert: {
            userId,
            date: dayStart,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          session,
        }
      );

      const bear = await Bear.findOne({ userId }).session(session);

      if (!bear) {
        throw new Error("Bear not found");
      }

      const alreadyRewarded = activity.stepsRewarded ?? 0;

      const newlyEligibleSteps = Math.max(
        0,
        eligibleSteps - alreadyRewarded
      );

      const rewardUnits =
        Math.floor(newlyEligibleSteps / STEPS_PER_REWARD);

      const potentialEnergy =
        rewardUnits * ENERGY_PER_REWARD;

      const availableEnergy = Math.max(
        0,
        bear.maxEnergy - bear.energy
      );

      const energyAwarded = Math.min(
        potentialEnergy,
        availableEnergy
      );

      if (newlyEligibleSteps > 0) {
        activity.stepsRewarded = eligibleSteps;
        await activity.save({ session });
      }

      if (energyAwarded > 0) {
        bear.energy += energyAwarded;
        await bear.save({ session });
      }

      result = {
        stepsToday: reportedSteps,
        stepsRewarded: activity.stepsRewarded ?? 0,
        energyAwarded,
        totalEnergy: bear.energy,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}
