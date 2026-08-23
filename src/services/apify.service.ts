import { ApifyClient } from "apify-client";
import DUMMY_DATA from "./DUMMY_DATA.json" with { type: "json" };
import type { FacebookComment, FacebookPost, ScrapeOptions, CommentScrapeOptions } from "./types.js";

const ACTOR_ID = "apify/facebook-posts-scraper";
const COMMENTS_ACTOR_ID = "apify/facebook-comments-scraper";



class ApifyService {
  private isTesting = process.env.DO_NOT_SEND_API_REQUEST === "true";
  private getClient(): ApifyClient {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      throw new Error("APIFY_API_TOKEN is not set");
    }
    return new ApifyClient({ token });
  }

  async scrapeFacebookPosts(
    targetUrls: string[] = [],
    options: ScrapeOptions = {},
  ): Promise<FacebookPost[]> {
    console.log(
      `[apifyService] Starting run for ${targetUrls.length} URL(s):`,
      targetUrls,
    );

    if (this.isTesting) {
      return DUMMY_DATA.posts;
    }

    const client = this.getClient();

    const run = await client.actor(ACTOR_ID).call({
      startUrls: targetUrls.map((url) => ({ url })),
      resultsLimit: options.resultsLimit,
      onlyPostsNewerThan: options.onlyPostsNewerThan,
    });

    console.log(
      `[apifyService] Run finished with status "${run.status}", dataset ${run.defaultDatasetId}`,
    );

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`[apifyService] Raw dataset (${items.length} item(s)):`, items);

    const filtered = (items as FacebookPost[]).filter(
      (post) => typeof post.text === "string" && post.text.trim().length > 0,
    );

    console.log(
      `[apifyService] ${filtered.length} item(s) with real text after filtering`,
    );

    return filtered;
  }

  async scrapePostsComments(
    posts: FacebookPost[],
    options: CommentScrapeOptions = {},
  ): Promise<FacebookComment[]> {
    const postUrls = posts
      .map((post) => post.url)
      .filter((url): url is string => typeof url === "string");

    if (postUrls.length === 0) {
      return [];
    }

    console.log(
      `[apifyService] Starting comments run for ${postUrls.length} post(s):`,
      postUrls,
    );

    if (this.isTesting) {
      return DUMMY_DATA.comments ?? [];
    }

    const client = this.getClient();

    const run = await client.actor(COMMENTS_ACTOR_ID).call({
      startUrls: postUrls.map((url) => ({ url })),
      resultsLimit: options.resultsLimit,
      onlyCommentsNewerThan: options.onlyCommentsNewerThan,
      includeNestedComments: options.includeNestedComments,
    });

    console.log(
      `[apifyService] Comments run finished with status "${run.status}", dataset ${run.defaultDatasetId}`,
    );

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`[apifyService] Raw comments dataset (${items.length} item(s)):`, items);

    const filtered = (items as FacebookComment[]).filter(
      (comment) => typeof comment.text === "string" && comment.text.trim().length > 0,
    );

    console.log(
      `[apifyService] ${filtered.length} comment(s) with real text after filtering`,
    );

    return filtered;
  }
}

export const apifyService = new ApifyService();
