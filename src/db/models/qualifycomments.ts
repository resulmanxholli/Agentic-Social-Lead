import { Schema, model, Document } from "mongoose";

export interface CommentDocument extends Document {
  commentId: string;
  keyword: string;
  postUrl?: string;
  authorId?: string;
  text: string;
  commentUrl: string;
  wasQualified: boolean;
  processedAt: Date;
}

const CommentSchema = new Schema<CommentDocument>({
  commentId: { type: String, required: true },
  keyword: { type: String, required: true },
  postUrl: String,
  authorId: String,
  text: String,
  commentUrl: String,
  wasQualified: { type: Boolean, required: true },
  processedAt: { type: Date, default: Date.now },
});

CommentSchema.index({ commentId: 1, keyword: 1 }, { unique: true });

export const Comment = model<CommentDocument>("Comment", CommentSchema);
