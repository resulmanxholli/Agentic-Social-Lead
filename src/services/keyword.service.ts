import { Keyword } from "../db/models/keyword.js";

class KeywordService {
  createKeyword(keyword: string, cron: string) {
    const doc = new Keyword({ keyword, cron });
    return doc.save();
  }

  getKeywords() {
    return Keyword.find();
  }

  setEnabled(id: string, enabled: boolean) {
    return Keyword.findByIdAndUpdate(id, { enabled }, { new: true });
  }
}

export const keywordService = new KeywordService();
