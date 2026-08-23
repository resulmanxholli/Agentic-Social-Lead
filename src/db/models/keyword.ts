import { Schema, model, Document } from "mongoose";

export type Platform = "facebook";

export interface KeywordDocument extends Document {
  keyword: string;
  cron: string;
  enabled: boolean;
  targetUrls: string[];
  lastScrapedAt?: Date;
  createdAt: Date;
}

const KeywordSchema = new Schema<KeywordDocument>({
  keyword: { type: String, required: true },
  cron: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  targetUrls: {
    type: [String],
    required: true,
    validate: {
      validator: (urls: string[]) => urls.length > 0,
      message: "targetUrls must contain at least one URL",
    },
  },
  lastScrapedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

KeywordSchema.index({ keyword: 1 }, { unique: true });

export const Keyword = model<KeywordDocument>("Keyword", KeywordSchema);
