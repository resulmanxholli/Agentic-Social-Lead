import { type Request, type Response } from "express";
import cron from "node-cron";
import { z } from "zod";
import { keywordService } from "../services/keyword.service.js";
import { schedulerService } from "../services/scheduler.service.js";

const createKeywordSchema = z.object({
  keyword: z.string().trim().min(1, "keyword must be a non-empty string"),
  cron: z.string().refine(cron.validate, {
    message: "cron must be a valid cron expression",
  }),
  targetUrls: z
    .array(z.string().url())
    .min(1, "targetUrls must contain at least one URL"),
});

export async function createKeywordController(req: Request, res: Response) {
  const parsed = createKeywordSchema.safeParse(req.body);

  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const { keyword, cron: cronExpression, targetUrls } = parsed.data;

  try {
    const created = await keywordService.createKeyword(keyword, cronExpression, targetUrls);
    if (created.enabled) {
      keywordService.scheduleKeyword({
        id: created._id.toString(),
        keyword: created.keyword,
        cron: created.cron,
      });
    }
    return res.status(201).json(created);
  } catch (err: any) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: `Keyword "${keyword}" already exists` });
    }
    throw err;
  }
}

export async function getKeywordsController(req: Request, res: Response) {
  const keywords = await keywordService.getKeywords();
  return res.status(200).json(keywords);
}

const updateKeywordSchema = z
  .object({
    keyword: z.string().trim().min(1, "keyword must be a non-empty string").optional(),
    cron: z
      .string()
      .refine(cron.validate, { message: "cron must be a valid cron expression" })
      .optional(),
    enabled: z.boolean().optional(),
    targetUrls: z
      .array(z.string().url())
      .min(1, "targetUrls must contain at least one URL")
      .optional(),
  })
  .refine(
    (data) =>
      data.keyword !== undefined ||
      data.cron !== undefined ||
      data.enabled !== undefined ||
      data.targetUrls !== undefined,
    { message: "At least one field must be provided" },
  );

export async function updateKeywordController(req: Request, res: Response) {
  const parsed = updateKeywordSchema.safeParse(req.body);

  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const { id } = req.params;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid keyword id" });
  }

  let existing;
  try {
    existing = await keywordService.getKeywordById(id);
  } catch (err: any) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: `Keyword "${id}" not found` });
    }
    throw err;
  }

  if (!existing) {
    return res.status(404).json({ error: `Keyword "${id}" not found` });
  }

  const oldKeywordName = existing.keyword;

  const updates = {
    ...(parsed.data.keyword !== undefined ? { keyword: parsed.data.keyword } : {}),
    ...(parsed.data.cron !== undefined ? { cron: parsed.data.cron } : {}),
    ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
    ...(parsed.data.targetUrls !== undefined ? { targetUrls: parsed.data.targetUrls } : {}),
  };

  let updated;
  try {
    updated = await keywordService.updateKeyword(id, updates);
  } catch (err: any) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: `Keyword "${parsed.data.keyword}" already exists` });
    }
    if (err.name === "CastError") {
      return res.status(404).json({ error: `Keyword "${id}" not found` });
    }
    throw err;
  }

  if (!updated) {
    return res.status(404).json({ error: `Keyword "${id}" not found` });
  }

  const nameChanged = parsed.data.keyword !== undefined && parsed.data.keyword !== oldKeywordName;
  const rescheduleNeeded =
    nameChanged || parsed.data.cron !== undefined || parsed.data.enabled !== undefined;

  if (nameChanged) {
    schedulerService.disableSchedule(oldKeywordName);
  }

  if (rescheduleNeeded) {
    if (updated.enabled) {
      keywordService.scheduleKeyword({
        id: updated._id.toString(),
        keyword: updated.keyword,
        cron: updated.cron,
      });
    } else {
      schedulerService.disableSchedule(updated.keyword);
    }
  }

  return res.status(200).json(updated);
}
