import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import statusRouter from "./routes/status.route.js";
import { connectDb } from "./db/connection.js";
import { keywordService } from "./services/keyword.service.js";
import keywordRouter from "./routes/keyword.route.js";
import leadRouter from "./routes/lead.route.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, "../frontend/dist");

const app = express();
app.use(express.json());
app.use(statusRouter);
app.use(keywordRouter);
app.use(leadRouter);
app.use(express.static(frontendDist));

const PORT = process.env.PORT || 3000;

connectDb()
  .then(() => {
    keywordService.startScheduler();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
