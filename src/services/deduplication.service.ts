import { Lead } from "../db/models/lead.js";
import { Post, type PostDocument } from "../db/models/post.js";
import { Comment } from "../db/models/qualifycomments.js";
import type { FacebookComment, FacebookPost } from "./types.js";

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

class DeduplicationService {
  async filterNewPosts(posts: FacebookPost[], keyword: string) {
    const postIds = posts
      .map((post) => post.postId)
      .filter((id): id is string => Boolean(id));

    if (postIds.length === 0) return posts;

    const existing = await Post.find({ postId: { $in: postIds } }).select("postId");
    const seenPostIds = new Set(existing.map((p) => p.postId));

    return posts.filter((post) => !post.postId || !seenPostIds.has(post.postId));
  }

  async recordPost(post: FacebookPost, keyword: string, isRelevant: boolean) {
    const postId = post.postId;
    if (!postId) return;

    try {
      await Post.create({
        postId,
        keyword,
        text: post.text ?? "",
        url: post.url ?? "",
        isRelevant,
        postedAt: parseDate(post.time) ?? new Date(),
        watching: isRelevant,
        ...(post.pageName ? { pageName: post.pageName } : {}),
      });
    } catch (err: any) {
      if (err.code !== 11000) {
        console.error(`[deduplicationService] Failed to record post ${postId}`, err);
      }
    }
  }

  async getWatchedPosts(keyword: string, notOlderThan: Date): Promise<PostDocument[]> {
    return Post.find({
      keyword,
      watching: true,
      postedAt: { $gte: notOlderThan },
    });
  }

  async recordCommentSweep(posts: FacebookPost[], keyword: string, notOlderThan: Date) {
    const now = new Date();

    for (const post of posts) {
      const postId = post.postId;
      if (!postId) continue;

      const postedAt = parseDate(post.time) ?? now;

      try {
        await Post.updateOne(
          { postId, keyword },
          { lastCommentSweepAt: now, watching: postedAt >= notOlderThan },
        );
      } catch (err) {
        console.error(`[deduplicationService] Failed to record comment sweep for post ${postId}`, err);
      }
    }
  }

  async filterNewComments(comments: FacebookComment[], keyword: string) {
    const structurallyValid = comments.filter(
      (comment) => typeof comment.text === "string" && comment.text.trim().length >= 10,
    );

    const commentIds = structurallyValid
      .map((comment) => comment.commentId)
      .filter((id): id is string => Boolean(id));

    if (commentIds.length === 0) return structurallyValid;

    const existing = await Comment.find({ commentId: { $in: commentIds }, keyword }).select(
      "commentId",
    );
    const seenCommentIds = new Set(existing.map((c) => c.commentId));

    return structurallyValid.filter(
      (comment) => !comment.commentId || !seenCommentIds.has(comment.commentId),
    );
  }

  async recordComment(comment: FacebookComment, keyword: string, wasQualified: boolean) {
    const commentId = comment.commentId;
    if (!commentId) return;

    try {
      await Comment.create({
        commentId,
        keyword,
        ...(typeof comment.facebookUrl === "string" ? { postUrl: comment.facebookUrl } : {}),
        ...(comment.author?.id ? { authorId: comment.author.id } : {}),
        text: comment.text ?? "",
        commentUrl: comment.commentUrl ?? "",
        wasQualified,
      });
    } catch (err: any) {
      if (err.code !== 11000) {
        console.error(`[deduplicationService] Failed to record comment ${commentId}`, err);
      }
    }
  }

  async filterNewLeadsFromComments(comments: FacebookComment[], keyword: string) {
    const identifiable = comments.filter(
      (comment): comment is FacebookComment & { author: { id: string } } =>
        Boolean(comment.author?.id),
    );

    const droppedCount = comments.length - identifiable.length;
    if (droppedCount > 0) {
      console.warn(
        `[deduplicationService] Dropping ${droppedCount} comment(s) with no resolvable author id`,
      );
    }

    if (identifiable.length === 0) return [];

    const existingLeads = await Lead.find({
      platform: "facebook",
      profileId: { $in: identifiable.map((comment) => comment.author.id) },
      keyword,
    }).select("profileId");
    const seenProfileIds = new Set(existingLeads.map((lead) => lead.profileId));

    return identifiable.filter((comment) => !seenProfileIds.has(comment.author.id));
  }
}

export const deduplicationService = new DeduplicationService();
