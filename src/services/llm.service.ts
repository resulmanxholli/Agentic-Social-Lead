import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { FacebookComment, FacebookPost, QualifiedLead } from "./types.js";
import DUMMY_DATA from "./DUMMY_DATA.json" with { type: "json" };

const QualificationSchema = z.object({
  isRelevant: z
    .boolean()
    .describe(
      "false if this is spam, a job seeker, a competitor, or otherwise not a genuine lead for the keyword",
    ),
  intentScore: z.number().int().min(0).max(100),
  intentReasoning: z.string().describe("One sentence explaining the score"),
  fullName: z.string().describe("Standardized version of the author's name"),
  jobTitle: z
    .string()
    .nullable()
    .describe("Job title if mentioned in the post text, else null"),
  companyName: z
    .string()
    .nullable()
    .describe("Company name if mentioned in the post text, else null"),
  location: z
    .string()
    .nullable()
    .describe("City/region/country if mentioned in the comment text, else null"),
});

const QualificationJsonSchema = z.toJSONSchema(QualificationSchema);

const PostRelevanceSchema = z.object({
  isRelevant: z
    .boolean()
    .describe(
      "true if this post's topic is likely to attract comments from people showing genuine buying intent related to the keyword",
    ),
  reasoning: z.string().describe("One sentence explaining the decision"),
});

const PostRelevanceJsonSchema = z.toJSONSchema(PostRelevanceSchema);

class RequestQueue {
  private pending: Array<() => void> = [];
  private active = 0;

  constructor(private readonly concurrency: number) {}

  // Hands the freed slot directly to the next waiter instead of decrementing `active` and
  // letting it be re-claimed by whoever calls run() next: decrementing here would leave a
  // window, between this resolve() and the queued waiter's async function actually resuming,
  // where a fresh caller could see a stale "slot free" count and slip in alongside it.
  private release() {
    const next = this.pending.shift();
    if (next) {
      next();
    } else {
      this.active--;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.pending.push(resolve));
    } else {
      this.active++;
    }
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

class QualificationService {
  private isTesting = process.env.DO_NOT_SEND_API_REQUEST === "true";
  private requestQueue = new RequestQueue(1);
  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    return new GoogleGenAI({ apiKey });
  }

  private hashToRange(seed: string, min: number, max: number): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return min + (Math.abs(hash) % (max - min + 1));
  }

  private parseRetryDelayMs(err: any): number | null {
    try {
      const body = JSON.parse(err.message);
      const retryInfo = body?.error?.details?.find(
        (d: any) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
      );
      const retryDelay = retryInfo?.retryDelay;
      if (typeof retryDelay === "string" && retryDelay.endsWith("s")) {
        return parseFloat(retryDelay) * 1000;
      }
    } catch {
      // fall back to exponential backoff below
    }
    return null;
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        if (err?.status !== 429 || attempt >= maxRetries) {
          throw err;
        }
        const delayMs = this.parseRetryDelayMs(err) ?? 2 ** attempt * 1000;
        console.warn(
          `[qualificationService] Rate limited (429), retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async qualifyPost(post: FacebookPost, keyword: string): Promise<boolean> {
    if (this.isTesting) {
      return DUMMY_DATA.isPostRelevant;
    }
    const client = this.getClient();

    const response = await this.requestQueue.run(() =>
      this.withRetry(() =>
        client.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `Tracked keyword: "${keyword}"\nPost text: "${post.text ?? ""}"`,
          config: {
            systemInstruction:
              "You screen social media posts for a sales team. The team tracks the keyword/topic below " +
              "because it signals buying intent for their product. A post's own author is never the lead — " +
              "leads come from people who comment on relevant posts. Decide only whether this post's topic " +
              "is likely to attract comments from people expressing genuine interest or intent related to the keyword.",
            responseMimeType: "application/json",
            responseJsonSchema: PostRelevanceJsonSchema,
          },
        }),
      ),
    );

    const raw = response.text;
    if (!raw) {
      return false;
    }

    const parsed = PostRelevanceSchema.parse(JSON.parse(raw));

    return parsed.isRelevant;
  }


  async qualifyComment(
    comment: FacebookComment,
    keyword: string,
    minIntentScore: number,
  ): Promise<QualifiedLead | null> {
    if (this.isTesting) {
      const fullName = comment.author?.name ?? comment.profileName ?? DUMMY_DATA.lead.fullName;
      const seed = comment.commentId ?? comment.text ?? fullName;
      const intentScore = this.hashToRange(seed, 40, 95);
      return { ...DUMMY_DATA.lead, fullName, intentScore };
    }
    const client = this.getClient();

    const response = await this.requestQueue.run(() =>
      this.withRetry(() =>
        client.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `Tracked keyword: "${keyword}"\nAuthor's raw name: "${comment.author?.name ?? "unknown"}"\nComment text: "${comment.text ?? ""}"`,
          config: {
            systemInstruction:
              "You qualify leads for a sales team by reading a single social media comment. " +
              "The team tracks the keyword/topic below because it signals buying intent for their product. " +
              "Score how likely this specific comment's author is a genuine, actionable sales lead, not spam, " +
              "a job seeker, or a competitor. Extract only what the comment text actually states — never invent details.",
            responseMimeType: "application/json",
            responseJsonSchema: QualificationJsonSchema,
          },
        }),
      ),
    );

    const raw = response.text;
    if (!raw) {
      return null;
    }

    const parsed = QualificationSchema.parse(JSON.parse(raw));

    if (!parsed.isRelevant || parsed.intentScore < minIntentScore) {
      return null;
    }

    return {
      fullName: parsed.fullName,
      ...(parsed.jobTitle ? { jobTitle: parsed.jobTitle } : {}),
      ...(parsed.companyName ? { companyName: parsed.companyName } : {}),
      ...(parsed.location ? { location: parsed.location } : {}),
      intentScore: parsed.intentScore,
      intentReasoning: parsed.intentReasoning,
    };
  }

  async enrichLead(
    lead: QualifiedLead,
    profileUrl?: string,
  ): Promise<{ email?: string; phone?: string; companyWebsite?: string }> {
    if (this.isTesting) {
      return {};
    }
    const client = this.getClient();

    const response = await this.requestQueue.run(() =>
      this.withRetry(() =>
        client.models.generateContent({
          model: "gemini-3.6-flash",
          contents:
            `Full name: "${lead.fullName}"` +
            (lead.companyName ? `\nCompany: "${lead.companyName}"` : "") +
            (lead.jobTitle ? `\nJob title: "${lead.jobTitle}"` : "") +
            (lead.location ? `\nLocation: "${lead.location}"` : "") +
            (profileUrl ? `\nProfile URL: "${profileUrl}"` : ""),
          config: {
            systemInstruction:
              "You research public contact information for a sales team's lead — a real person who may or may " +
              "not have an associated company. Use web search to find the best publicly available contact " +
              "information for this specific person: a personal or business email, a phone number, and a website " +
              "(their company's if they have one, otherwise a personal or professional page such as a business " +
              "listing or LinkedIn). Only report what search actually surfaces — never guess, infer, or construct " +
              "an email, phone number, or website you did not find. Respond in exactly this format, one line per " +
              "field, using NONE for anything you could not find:\n" +
              "WEBSITE: <url or NONE>\nEMAIL: <email or NONE>\nPHONE: <phone or NONE>",
            tools: [{ googleSearch: {} }],
          },
        }),
      ),
    );

    const raw = response.text ?? "";
    const website = /WEBSITE:\s*(.+)/i.exec(raw)?.[1]?.trim();
    const email = /EMAIL:\s*(.+)/i.exec(raw)?.[1]?.trim();
    const phone = /PHONE:\s*(.+)/i.exec(raw)?.[1]?.trim();

    const result: { email?: string; phone?: string; companyWebsite?: string } = {};
    if (website && !/^none$/i.test(website)) {
      result.companyWebsite = website;
    }
    if (email && !/^none$/i.test(email) && email.includes("@")) {
      result.email = email;
    }
    if (phone && !/^none$/i.test(phone)) {
      result.phone = phone;
    }
    return result;
  }
}

export const qualificationService = new QualificationService();
