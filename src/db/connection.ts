import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not set');
}

export async function connectDb() {
  await mongoose.connect(MONGODB_URI as string);
}

export { mongoose };
