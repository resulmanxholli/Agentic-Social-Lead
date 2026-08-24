import { Keyword } from "../db/models/keyword.js";
import { schedulerService } from "./scheduler.service.js";
import { apifyService} from "./apify.service.js";
import type { FacebookComment, FacebookPost, QualifiedLead } from "./types.js";
import { qualificationService } from "./llm.service.js";
import { deduplicationService } from "./deduplication.service.js";
import { leadService } from "./lead.service.js";

class KeywordService {
  
  createKeyword(keyword: string, cron: string, targetUrls: string[]) {
    const doc = new Keyword({ keyword, cron, targetUrls });
    return doc.save();
  }

  getKeywords() {
    return Keyword.find();
  }

  getKeywordById(id: string) {
    return Keyword.findById(id);
  }

  updateKeyword(
    id: string,
    updates: { keyword?: string; cron?: string; enabled?: boolean; targetUrls?: string[] },
  ) {
    return Keyword.findByIdAndUpdate(id, updates, { new: true });
  }
  
  async getLedsFromFacebookPostsComments(keywordId: string) {
        try {
      const keywordDoc = await Keyword.findById(keywordId);
      if (!keywordDoc) return;

      const posts = await apifyService.scrapeFacebookPosts(keywordDoc.targetUrls);

      keywordDoc.lastScrapedAt = new Date();
      await keywordDoc.save();

      const newPosts = await deduplicationService.filterNewPosts(posts);

      await this.qualifyPosts(newPosts, keywordDoc.keyword);

      const comments = await apifyService.scrapePostsComments(newPosts);

      const newComments = await deduplicationService.filterNewComments(
        comments,
        keywordDoc.keyword,
      );
      const fileteredComments = await deduplicationService.filterNewLeadsFromComments(
        newComments,
        keywordDoc.keyword,
      );
      const qualifiedLeads = await this.qualifyComments(fileteredComments, keywordDoc.keyword);

      const savedLeads = await leadService.saveLeadsFromComments(qualifiedLeads, keywordDoc.keyword);

    } catch (err) {
      console.error(`[keywordService] executeKeyword failed for keyword ${keywordId}`, err);
    }
  }
  async executeKeyword(keywordId: string) {
    try {
      await this.getLedsFromFacebookPostsComments(keywordId);
    } catch (err) {
      console.error(`[keywordService] executeKeyword failed for keyword ${keywordId}`, err);
    }
  }

  async qualifyPosts(posts: FacebookPost[], keyword: string) {
    const relevant: FacebookPost[] = [];

    for (const post of posts) {
      try {
        const isRelevant = await qualificationService.qualifyPost(post, keyword);
        await deduplicationService.recordPost(post, keyword, isRelevant);
        if (isRelevant) {
          relevant.push(post);
        }
      } catch (err) {
        console.error(`[keywordService] qualification failed for a post`, err);
      }
    }

    return relevant;
  }

  async qualifyComments(comments: FacebookComment[], keyword: string) {
    const qualified: Array<{ comment: FacebookComment; lead: QualifiedLead }> = [];
    for (const comment of comments) {
      try {
        const lead = await qualificationService.qualifyComment(comment, keyword);
        await deduplicationService.recordComment(comment, Boolean(lead));
        if (lead) {
          try {
            Object.assign(lead, await qualificationService.enrichLead(lead));
          } catch (err) {
            console.error(`[keywordService] enrichment failed for a lead`, err);
          }
          qualified.push({ comment, lead });
        }
      } catch (err) {
        console.error(`[keywordService] qualification failed for a comment`, err);
      }
  }
    return qualified;
  }

  scheduleKeyword({
    id,
    keyword,
    cron: cronExpression,
  }: {
    id: string;
    keyword: string;
    cron: string;
  }) {
    schedulerService.createSchedule(
      { keyword, cron: cronExpression },
      async () => {
        await this.executeKeyword(id);
      },
    );
  }

  async startScheduler() {
    const activeKeywords = await Keyword.find({ enabled: true });

    for (const keywordDoc of activeKeywords) {
      this.scheduleKeyword({
        id: keywordDoc._id.toString(),
        keyword: keywordDoc.keyword,
        cron: keywordDoc.cron,
      });
    }
  }
}

export const keywordService = new KeywordService();
