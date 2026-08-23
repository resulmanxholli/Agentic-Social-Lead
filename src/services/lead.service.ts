import { Lead } from "../db/models/lead.js";
import type { FacebookComment, FacebookPost, QualifiedLead } from "./types.js";

class LeadService {
  async saveLeads(qualified: Array<{ post: FacebookPost; lead: QualifiedLead }>) {
    const saved = [];

    for (const { post, lead } of qualified) {
      const profileId = post.user?.id;
      if (!profileId) continue;

      try {
        const doc = await Lead.create({
          platform: "facebook",
          profileId,
          profileUrl: `https://www.facebook.com/${profileId}`,
          fullName: lead.fullName,
          ...(lead.jobTitle ? { jobTitle: lead.jobTitle } : {}),
          ...(lead.companyName ? { companyName: lead.companyName } : {}),
          triggerContext: post.text ?? "",
          sourceUrl: post.url ?? "",
          intentScore: lead.intentScore,
          intentReasoning: lead.intentReasoning,
        });
        saved.push(doc);
      } catch (err: any) {
        if (err.code === 11000) {
          continue;
        }
        console.error(`[leadService] Failed to save lead for profile ${profileId}`, err);
      }
    }

    return saved;
  }

  async saveLeadsFromComments(
    qualified: Array<{ comment: FacebookComment; lead: QualifiedLead }>,
  ) {
    const saved = [];

    for (const { comment, lead } of qualified) {
      const profileId = comment.author?.id;
      if (!profileId) continue;

      try {
        const doc = await Lead.create({
          platform: "facebook",
          profileId,
          profileUrl:
            typeof comment.profileUrl === "string"
              ? comment.profileUrl
              : `https://www.facebook.com/${profileId}`,
          fullName: lead.fullName,
          ...(lead.jobTitle ? { jobTitle: lead.jobTitle } : {}),
          ...(lead.companyName ? { companyName: lead.companyName } : {}),
          triggerContext: comment.text ?? "",
          sourceUrl: comment.commentUrl ?? comment.facebookUrl ?? "",
          intentScore: lead.intentScore,
          intentReasoning: lead.intentReasoning,
        });
        saved.push(doc);
      } catch (err: any) {
        if (err.code === 11000) {
          continue;
        }
        console.error(`[leadService] Failed to save lead for profile ${profileId}`, err);
      }
    }

    return saved;
  }

  getLeads() {
    return Lead.find().sort({ createdAt: -1 });
  }
}

export const leadService = new LeadService();
