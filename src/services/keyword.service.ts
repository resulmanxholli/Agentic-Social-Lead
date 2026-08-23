import { Keyword } from "../db/models/keyword.js";
import { schedulerService } from "./scheduler.service.js";
import { apifyService } from "./apify.service.js";

class KeywordService {
  
  createKeyword(keyword: string, cron: string, targetUrls: string[]) {
    const doc = new Keyword({ keyword, cron, targetUrls });
    return doc.save();
  }

  getKeywords() {
    return Keyword.find();
  }

  setEnabled(id: string, enabled: boolean) {
    return Keyword.findByIdAndUpdate(id, { enabled }, { new: true });
  }

  async executeTest(keywordId: string) {
    try {
      const keywordDoc = await Keyword.findById(keywordId);
      if (!keywordDoc) return;

      const rawResults = await apifyService.scrapeFacebookPosts(keywordDoc.targetUrls, {
        ...(keywordDoc.lastScrapedAt
          ? { onlyPostsNewerThan: keywordDoc.lastScrapedAt.toISOString() }
          : {}),
      });

      keywordDoc.lastScrapedAt = new Date();
      await keywordDoc.save();

      // 2. Filter out already-seen profiles (dedup)
      // const newLeads = await filterNewLeads(rawResults);

      // 3. Run LLM qualification on each new lead
      // const qualifiedLeads = await qualifyLeads(newLeads);

      // 4. Save qualified leads to MongoDB
      // await saveLeads(qualifiedLeads);
    } catch (err) {
      console.error(`[keywordService] executeTest failed for keyword ${keywordId}`, err);
    }
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
        await this.executeTest(id);
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
