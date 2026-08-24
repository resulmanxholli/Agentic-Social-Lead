import { Schema, model } from 'mongoose';

export type Platform = 'facebook';
export type InteractionType = 'commenter' | 'author';

export interface LeadDocument {
  platform: Platform;
  profileId: string;
  profileUrl: string;
  keyword: string;
  fullName: string;
  jobTitle?: string;
  companyName?: string;
  location?: string;
  email?: string;
  phone?: string;
  companyWebsite?: string;
  triggerContext: string;
  sourceUrl: string;
  pageName?: string;
  interactionType: InteractionType;
  interactionAt: Date;
  intentScore: number;
  intentReasoning: string;
  createdAt: Date;
}

const leadSchema = new Schema<LeadDocument>({
  platform: { type: String, enum: ['facebook'], required: true },
  profileId: { type: String, required: true },
  profileUrl: { type: String, required: true },
  keyword: { type: String, required: true },
  fullName: { type: String, required: true },
  jobTitle: String,
  companyName: String,
  location: String,
  email: String,
  phone: String,
  companyWebsite: String,
  triggerContext: { type: String, required: true },
  sourceUrl: { type: String, required: true },
  pageName: String,
  interactionType: { type: String, enum: ['commenter', 'author'], required: true },
  interactionAt: { type: Date, required: true },
  intentScore: { type: Number, required: true },
  intentReasoning: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

leadSchema.index({ platform: 1, profileId: 1, keyword: 1 }, { unique: true });

export const Lead = model<LeadDocument>('Lead', leadSchema);
