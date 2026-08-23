import { ApifyClient } from "apify-client";

const ACTOR_ID = "apify/facebook-posts-scraper";

export interface FacebookPost {
  text?: string;
  [key: string]: unknown;
}

export interface ScrapeOptions {
  resultsLimit?: number;
  onlyPostsNewerThan?: string;
}

class ApifyService {
  private getClient(): ApifyClient {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      throw new Error("APIFY_API_TOKEN is not set");
    }
    return new ApifyClient({ token });
  }

  async scrapeFacebookPosts(
    targetUrls: string[],
    options: ScrapeOptions = {},
  ): Promise<FacebookPost[]> {
    const client = this.getClient();

    const run = await client.actor(ACTOR_ID).call({
      startUrls: targetUrls.map((url) => ({ url })),
      resultsLimit: options.resultsLimit,
      onlyPostsNewerThan: options.onlyPostsNewerThan,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    return (items as FacebookPost[]).filter(
      (post) => typeof post.text === "string" && post.text.trim().length > 0,
    );
  }

  
}

export const apifyService = new ApifyService();
