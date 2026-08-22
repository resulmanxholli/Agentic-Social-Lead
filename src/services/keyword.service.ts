import { Keyword } from '../db/models/keyword.js';

export async function createKeyword(keyword: string, cron: string) {
  const doc = new Keyword({ keyword, cron });
  return doc.save();
}