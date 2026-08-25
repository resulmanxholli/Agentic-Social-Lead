import { Schema, model, Document } from "mongoose";

export interface PostDocument extends Document {
  postId: string;
  keyword: string;
  text: string;
  url: string;
  isRelevant: boolean;
  postedAt: Date;
  pageName?: string;
  watching: boolean;
  lastCommentSweepAt?: Date;
  processedAt: Date;
}

const PostSchema = new Schema<PostDocument>({
  postId: { type: String, required: true },
  keyword: { type: String, required: true },
  text: String,
  url: String,
  isRelevant: { type: Boolean, required: true },
  postedAt: { type: Date, required: true },
  pageName: String,
  watching: { type: Boolean, default: false },
  lastCommentSweepAt: { type: Date },
  processedAt: { type: Date, default: Date.now },
});

PostSchema.index({ postId: 1, keyword: 1 }, { unique: true });
PostSchema.index({ keyword: 1, watching: 1, postedAt: 1 });

export const Post = model<PostDocument>("Post", PostSchema);
