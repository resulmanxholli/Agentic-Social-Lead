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



class QualificationService {
  private isTesting = process.env.DO_NOT_SEND_API_REQUEST === "true";
  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    return new GoogleGenAI({ apiKey });
  }

  async qualifyPost(post: FacebookPost, keyword: string): Promise<boolean> {
    if (this.isTesting) {
      return DUMMY_DATA.isPostRelevant;
    }
    const client = this.getClient();

    const response = await client.models.generateContent({
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
    });

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
  ): Promise<QualifiedLead | null> {
    if (this.isTesting) {
      return DUMMY_DATA.lead;
    }
    const client = this.getClient();

    const response = await client.models.generateContent({
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
    });

    const raw = response.text;
    if (!raw) {
      return null;
    }

    const parsed = QualificationSchema.parse(JSON.parse(raw));

    if (!parsed.isRelevant) {
      return null;
    }

    // TODO: CHECK THE SCORE
    // if (parsed.intentScore < 50) {
    //   return null;
    // }

    return {
      fullName: parsed.fullName,
      ...(parsed.jobTitle ? { jobTitle: parsed.jobTitle } : {}),
      ...(parsed.companyName ? { companyName: parsed.companyName } : {}),
      intentScore: parsed.intentScore,
      intentReasoning: parsed.intentReasoning,
    };
  }
}

export const qualificationService = new QualificationService();
