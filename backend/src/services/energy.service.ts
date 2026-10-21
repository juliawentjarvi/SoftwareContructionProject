
import mongoose from "mongoose";
import Bear from "../models/Bear";
import User from "../models/User";
import DailyActivity from "../models/DailyActivity";
import Meal, { type MealType } from "../models/Meal";

type LogMealInput = {
  userId: string;
  name: string;
  type: MealType;
  notes?: string;
  eatenAt: Date;
};

export async function logMealWithEnergy(input: LogMealInput) {
  const session = await mongoose.startSession();

  try {
    let savedMeal;

    await session.withTransaction(async () => {
      const user = await User.findById(input.userId).session(session);

      if (!user) {
        throw new Error("User not found");
      }

      const now = new Date();
      const dayStart = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate()
        )
      );

      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const isToday =
        input.eatenAt >= dayStart &&
        input.eatenAt < dayEnd;

      const dailyGoal = Math.max(
        0,
        Math.floor(user.dailyMealGoal ?? 3)
      );

      let energyAwarded = 0;

      if (isToday && dailyGoal > 0) {
        // One reward record per user per UTC day.
        // The unique index prevents duplicate daily records.
        const reward = await DailyActivity.findOneAndUpdate(
          {
            userId: input.userId,
            date: dayStart,
          },
          {
            $setOnInsert: {
              userId: input.userId,
              date: dayStart,
              mealsRewarded: 0,
            },
          },
          {
            upsert: true,
            new: true,
            session,
          }
        );

        if (reward.mealsRewarded < dailyGoal) {
          const bear = await Bear.findOne({
            userId: input.userId,
          }).session(session);

          if (!bear) {
            throw new Error("Bear not found");
          }

          const availableEnergy = Math.max(
            0,
            bear.maxEnergy - bear.energy
          );

          energyAwarded = Math.min(10, availableEnergy);

          // Count an eligible meal even when the bear is full.
          reward.mealsRewarded += 1;
          await reward.save({ session });

          if (energyAwarded > 0) {
            bear.energy += energyAwarded;
            await bear.save({ session });
          }
        }
      }

      const meals = await Meal.create(
        [
          {
            userId: input.userId,
            name: input.name,
            type: input.type,
            notes: input.notes,
            eatenAt: input.eatenAt,
            energyAwarded,
          },
        ],
        { session }
      );

      savedMeal = meals[0];
    });

    return savedMeal;
  } finally {
    await session.endSession();
  }
}
