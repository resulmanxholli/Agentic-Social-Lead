import { Keyword } from "../db/models/keyword.js";
import { schedulerService } from "./scheduler.service.js";
import { apifyService} from "./apify.service.js";
import type { FacebookComment, FacebookPost, QualifiedLead } from "./types.js";
import { qualificationService } from "./llm.service.js";
import { deduplicationService } from "./deduplication.service.js";
import { leadService } from "./lead.service.js";

const POST_WATCH_WINDOW_DAYS = Number(process.env.POST_WATCH_WINDOW_DAYS) || 7;
const POSTS_RESULTS_LIMIT = Number(process.env.POSTS_RESULTS_LIMIT) || 1;
const COMMENTS_RESULTS_LIMIT = Number(process.env.COMMENTS_RESULTS_LIMIT) || 10;

class KeywordService {
  
  createKeyword(
    keyword: string,
    cron: string,
    targetUrls: string[],
    minIntentScore?: number,
  ) {
    const doc = new Keyword({
      keyword,
      cron,
      targetUrls,
      ...(minIntentScore !== undefined ? { minIntentScore } : {}),
    });
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
    updates: {
      keyword?: string;
      cron?: string;
      enabled?: boolean;
      targetUrls?: string[];
      minIntentScore?: number;
    },
  ) {
    return Keyword.findByIdAndUpdate(id, updates, { new: true });
  }
  
  async getLedsFromFacebookPostsComments(keywordId: string) {
        try {
      const keywordDoc = await Keyword.findById(keywordId);
      if (!keywordDoc) return;

      const posts = await apifyService.scrapeFacebookPosts(
        keywordDoc.targetUrls,
        {
          resultsLimit: POSTS_RESULTS_LIMIT,
          ...(keywordDoc.lastScrapedAt
            ? { onlyPostsNewerThan: keywordDoc.lastScrapedAt.toISOString() }
            : {}),
        },
      );

      const newPosts = await deduplicationService.filterNewPosts(posts, keywordDoc.keyword);

      const relevantPosts = await this.qualifyPosts(newPosts, keywordDoc.keyword);


      // OLDER POSTS THAT WERE PREVIOUSLY WATCHED, TO GET THEIR COMMENTS AS WELL
      const watchCutoff = new Date(Date.now() - POST_WATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const previouslyWatchedPosts = await deduplicationService.getWatchedPosts(
        keywordDoc.keyword,
        watchCutoff,
      );

      const previouslyWatchedAsFacebookPosts: FacebookPost[] = previouslyWatchedPosts.map(
        (post) => ({
          postId: post.postId,
          url: post.url,
          text: post.text,
          time: post.postedAt.toISOString(),
          ...(post.pageName ? { pageName: post.pageName } : {}),
        }),
      );

      const sweepTargets = [...relevantPosts, ...previouslyWatchedAsFacebookPosts];

      const comments = await apifyService.scrapePostsComments(sweepTargets, {
        resultsLimit: COMMENTS_RESULTS_LIMIT,
      });

      const newComments = await deduplicationService.filterNewComments(comments, keywordDoc.keyword);
      const fileteredComments = await deduplicationService.filterNewLeadsFromComments(
        newComments,
        keywordDoc.keyword,
      );
      const qualifiedLeads = await this.qualifyComments(
        fileteredComments,
        keywordDoc.keyword,
        keywordDoc.minIntentScore,
      );

      const savedLeads = await leadService.saveLeadsFromComments(qualifiedLeads, keywordDoc.keyword);

      await deduplicationService.recordCommentSweep(sweepTargets, keywordDoc.keyword, watchCutoff);

      keywordDoc.lastScrapedAt = new Date();
      await keywordDoc.save();

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

  async qualifyComments(comments: FacebookComment[], keyword: string, minIntentScore: number) {
    const qualified: Array<{ comment: FacebookComment; lead: QualifiedLead }> = [];
    for (const comment of comments) {
      try {
        const lead = await qualificationService.qualifyComment(comment, keyword, minIntentScore);
        await deduplicationService.recordComment(comment, keyword, Boolean(lead));
        if (lead) {
          let enrichedLead = lead;
          try {
            const profileUrl =
              typeof comment.profileUrl === "string" ? comment.profileUrl : undefined;
            enrichedLead = { ...lead, ...(await qualificationService.enrichLead(lead, profileUrl)) };
          } catch (err) {
            console.error(`[keywordService] enrichment failed for a lead`, err);
          }
          qualified.push({ comment, lead: enrichedLead });
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
