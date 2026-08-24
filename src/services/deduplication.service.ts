import { Lead } from "../db/models/lead.js";
import { Post } from "../db/models/post.js";
import { Comment } from "../db/models/qualifycomments.js";
import type { FacebookComment, FacebookPost } from "./types.js";

class DeduplicationService {
  async filterNewPosts(posts: FacebookPost[]) {
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
      });
    } catch (err: any) {
      if (err.code !== 11000) {
        console.error(`[deduplicationService] Failed to record post ${postId}`, err);
      }
    }
  }

  async filterNewComments(comments: FacebookComment[], keyword: string) {
    const keywordWords = keyword
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 3);

    const keywordMatched = comments.filter((comment) => {
      if (typeof comment.text !== "string" || comment.text.trim().length < 10) {
        return false;
      }
      const text = comment.text.toLowerCase();
      return keywordWords.some((word) => text.includes(word));
    });

    const commentIds = keywordMatched
      .map((comment) => comment.commentId)
      .filter((id): id is string => Boolean(id));

    if (commentIds.length === 0) return keywordMatched;

    const existing = await Comment.find({ commentId: { $in: commentIds } }).select(
      "commentId",
    );
    const seenCommentIds = new Set(existing.map((c) => c.commentId));

    return keywordMatched.filter(
      (comment) => !comment.commentId || !seenCommentIds.has(comment.commentId),
    );
  }

  async recordComment(comment: FacebookComment, wasQualified: boolean) {
    const commentId = comment.commentId;
    if (!commentId) return;

    try {
      await Comment.create({
        commentId,
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
    const profileIds = comments
      .map((comment) => comment.author?.id)
      .filter((id): id is string => Boolean(id));

    if (profileIds.length === 0) return [];

    const existingLeads = await Lead.find({
      platform: "facebook",
      profileId: { $in: profileIds },
      keyword,
    }).select("profileId");
    const seenProfileIds = new Set(existingLeads.map((lead) => lead.profileId));

    return comments.filter(
      (comment) => comment.author?.id && !seenProfileIds.has(comment.author.id),
    );
  }
}

export const deduplicationService = new DeduplicationService();
