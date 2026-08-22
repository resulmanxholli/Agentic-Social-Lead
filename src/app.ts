import "dotenv/config";
import express from "express";
import statusRouter from "./routes/status.route.js";
import { connectDb } from "./db/connection.js";
import { startScheduler } from "./services/scheduler.service.js";
import keywordRouter from "./routes/keyword.route.js";

const app = express();
app.use(express.json());
app.use(statusRouter);
app.use(keywordRouter);

const PORT = process.env.PORT || 3000;

connectDb()
  .then(() => {
    startScheduler();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
