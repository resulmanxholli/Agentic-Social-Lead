import { type Request, type Response } from "express";
import cron from "node-cron";
import { z } from "zod";
import { createKeyword } from "../services/keyword.service.js";

const createKeywordSchema = z.object({
  keyword: z.string().trim().min(1, 'keyword must be a non-empty string'),
  cron: z.string().refine(cron.validate, {
    message: 'cron must be a valid cron expression',
  }),
});

export async function createKeywordController(req: Request, res: Response) {
  const parsed = createKeywordSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
  }

  const { keyword, cron: cronExpression } = parsed.data;

  try {
    const created = await createKeyword(keyword, cronExpression);
    return res.status(201).json(created);
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ error: `Keyword "${keyword}" already exists` });
    }
    throw err;
  }
}