import { Keyword } from "../db/models/keyword.js";

class KeywordService {
  createKeyword(keyword: string, cron: string) {
    const doc = new Keyword({ keyword, cron });
    return doc.save();
  }
}

export const keywordService = new KeywordService();
