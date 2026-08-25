import { Lead } from "../db/models/lead.js";
import type { FacebookComment, QualifiedLead } from "./types.js";
import { webhookService } from "./webhook.service.js";

class LeadService {
  async saveLeadsFromComments(
    qualified: Array<{ comment: FacebookComment; lead: QualifiedLead }>,
    keyword: string,
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
          keyword,
          fullName: lead.fullName,
          ...(lead.jobTitle ? { jobTitle: lead.jobTitle } : {}),
          ...(lead.companyName ? { companyName: lead.companyName } : {}),
          ...(lead.location ? { location: lead.location } : {}),
          ...(lead.email ? { email: lead.email } : {}),
          ...(lead.phone ? { phone: lead.phone } : {}),
          ...(lead.companyWebsite ? { companyWebsite: lead.companyWebsite } : {}),
          triggerContext: comment.text ?? "",
          sourceUrl: comment.commentUrl ?? comment.facebookUrl ?? "",
          ...(comment.pageName ? { pageName: comment.pageName } : {}),
          interactionType: "commenter",
          interactionAt: comment.date ? new Date(comment.date) : new Date(),
          intentScore: lead.intentScore,
          intentReasoning: lead.intentReasoning,
        });
        saved.push(doc);
        await webhookService.pushLead(doc);
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
