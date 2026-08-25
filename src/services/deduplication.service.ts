import { Lead } from "../db/models/lead.js";
import type { FacebookComment, FacebookPost } from "./types.js";

class DeduplicationService {
  hasKeywordInPost(post: FacebookPost, keyword: string): boolean {
    const text = post.text ?? "";
    return text.toLowerCase().includes(keyword.toLowerCase());
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
