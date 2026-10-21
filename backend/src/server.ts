import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/database";
import authRoutes from "./routes/auth.routes";
import { protect, AuthRequest } from "./middleware/auth";
import bearRoutes from "./routes/bear.routes";
import mealRoutes from "./routes/meal.routes";
import settingsRoutes from "./routes/settings.routes";
import stepsRoutes from "./routes/steps.ruotes";
import sudokuRoutes from "./routes/sudoku.routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/bear", bearRoutes);
app.use("/api/meals", mealRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/steps", stepsRoutes);
app.use("/api/sudoku", sudokuRoutes);


app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Bear Care API is running!"
  });
});

app.get("/api/me", protect, (req: AuthRequest, res) => {
  res.json({
    message: "You are authenticated!",
    userId: req.userId
  });
});

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
