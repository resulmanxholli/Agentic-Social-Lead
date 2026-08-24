import type { LeadDocument } from "../db/models/lead.js";

class WebhookService {
  private webhookUrl = process.env.LEAD_WEBHOOK_URL;

  async pushLead(lead: LeadDocument): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });

      if (!response.ok) {
        console.error(
          `[webhookService] Webhook responded with status ${response.status} for profile ${lead.profileId}`,
        );
      }
    } catch (err) {
      console.error(`[webhookService] Failed to push lead ${lead.profileId} to webhook`, err);
    }
  }
}

export const webhookService = new WebhookService();
