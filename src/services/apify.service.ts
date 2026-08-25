import { ApifyClient } from "apify-client";
import DUMMY_DATA from "./DUMMY_DATA.json" with { type: "json" };
import type { FacebookComment, FacebookPost, ScrapeOptions, CommentScrapeOptions } from "./types.js";

const ACTOR_ID = "apify/facebook-posts-scraper";
const COMMENTS_ACTOR_ID = "apify/facebook-comments-scraper";
const MIN_SPACING_MS = 5000;

class RateLimitedQueue {
  private pending: Array<() => void> = [];
  private active = 0;
  private lastStartedAt = 0;

  constructor(
    private readonly concurrency: number,
    private readonly minSpacingMs: number,
  ) {}

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

    const wait = this.minSpacingMs - (Date.now() - this.lastStartedAt);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    this.lastStartedAt = Date.now();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

class ApifyService {
  private isTesting = process.env.DO_NOT_SEND_API_REQUEST === "true";
  private requestQueue = new RateLimitedQueue(1, MIN_SPACING_MS);
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

    const run = await this.requestQueue.run(() =>
      client.actor(ACTOR_ID).call({
        startUrls: targetUrls.map((url) => ({ url })),
        resultsLimit: options.resultsLimit,
        onlyPostsNewerThan: options.onlyPostsNewerThan,
      }),
    );

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

    const run = await this.requestQueue.run(() =>
      client.actor(COMMENTS_ACTOR_ID).call({
        startUrls: postUrls.map((url) => ({ url })),
        resultsLimit: options.resultsLimit,
        onlyCommentsNewerThan: options.onlyCommentsNewerThan,
        includeNestedComments: options.includeNestedComments,
      }),
    );

    console.log(
      `[apifyService] Comments run finished with status "${run.status}", dataset ${run.defaultDatasetId}`,
    );

    // TODO: use onlyCommentsNewerThan, IMPORTANT!!!!!!!!!!!!!!!!!!!!!
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`[apifyService] Raw comments dataset (${items.length} item(s)):`, items);

    const pageNameByUrl = new Map(
      posts
        .filter((post): post is FacebookPost & { url: string } => typeof post.url === "string")
        .map((post) => [post.url, post.pageName]),
    );

    const filtered = (items as FacebookComment[])
      .filter((comment) => typeof comment.text === "string" && comment.text.trim().length > 0)
      .map((comment) => {
        const pageName =
          comment.pageName ??
          (typeof comment.facebookUrl === "string" ? pageNameByUrl.get(comment.facebookUrl) : undefined);
        return pageName ? { ...comment, pageName } : comment;
      });

    console.log(
      `[apifyService] ${filtered.length} comment(s) with real text after filtering`,
    );

    return filtered;
  }
}

export const apifyService = new ApifyService();
