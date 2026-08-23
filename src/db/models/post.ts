import { Schema, model, Document } from "mongoose";

export interface PostDocument extends Document {
  postId: string;
  keyword: string;
  text: string;
  url: string;
  isRelevant: boolean;
  processedAt: Date;
}

const PostSchema = new Schema<PostDocument>({
  postId: { type: String, required: true },
  keyword: { type: String, required: true },
  text: String,
  url: String,
  isRelevant: { type: Boolean, required: true },
  processedAt: { type: Date, default: Date.now },
});

PostSchema.index({ postId: 1 }, { unique: true });

export const Post = model<PostDocument>("Post", PostSchema);
