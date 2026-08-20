import 'dotenv/config';
import express from 'express';
import statusRouter from './routes/status.js';
import { connectDb } from './db/connection.js';

const app = express();
app.use(express.json());
app.use(statusRouter);

const PORT = process.env.PORT || 3000;

await connectDb();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});