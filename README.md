# Agentic Social Lead

Turns Facebook pages into a stream of sales leads, automatically.

## The idea

You give it a **keyword** (a topic that signals buying intent — e.g. "apartment for rent") and a **Facebook page** to watch. On a schedule, it scrapes the page, runs everything through Gemini to figure out who's actually a lead, deduplicates against what it's already seen, optionally enriches contact info, and saves the result — pushing it to your CRM via webhook if you've configured one.

The bet: instead of a human scrolling Facebook groups looking for "does anyone rent apartments in X" comments, the pipeline does it continuously and only surfaces people worth actually reaching out to.

## Pipeline

```
Facebook page
  → scrape posts (Apify)
  → LLM: is this post lead-bait? (recorded for dedup, no longer gates comment scraping)
  → scrape comments on every new post (Apify)
  → drop comments that don't mention the keyword, or are too short, or were already processed
  → drop comments from people already a lead for this keyword
  → LLM: score this commenter's intent (0–100), extract name/title/company/location
  → enrich: if a company was found, Gemini + Google Search looks up a public email/phone/website
  → save as Lead (dedup'd by profile + keyword)
  → POST to LEAD_WEBHOOK_URL if configured
```

Every post and comment is recorded (`Post` / `Comment` collections) the moment it's processed — relevant or not — so a re-run never re-sends the same item to the LLM or re-scrapes the same URL.

**Note:** the LLM computes an `intentScore` for every comment, but the code that would discard low-score-but-"relevant" comments is currently commented out in `qualifyComment` (`llm.service.ts`) — right now any comment marked `isRelevant: true` becomes a lead regardless of score.

## Rate limiting

Two independent request queues, both concurrency 1, shared across the whole app (not per-keyword):

- **Gemini** (`llm.service.ts`) — every call goes through a queue plus retry-with-backoff on HTTP 429 (reads Google's `retryDelay` when given, otherwise exponential backoff, up to 3 retries).
- **Apify** (`apify.service.ts`) — every actor call goes through a queue with a minimum 5s spacing between request starts, so multiple keywords ticking at once don't all hit Facebook simultaneously.

## Data model

| Collection | Purpose |
|---|---|
| `Keyword` | A tracked topic: cron schedule + target Facebook page URLs + enabled flag |
| `Post` | Every scraped post, with the relevance verdict, so it's never re-qualified |
| `Comment` | Every scraped comment, with whether it produced a lead, so it's never re-qualified |
| `Lead` | A qualified person — see below |

**`Lead` fields:**

| Field | Notes |
|---|---|
| `platform`, `profileId`, `profileUrl` | Facebook only right now — no LinkedIn connector |
| `keyword` | Which tracked keyword surfaced this lead |
| `fullName`, `jobTitle`, `companyName`, `location` | LLM-extracted from the comment text only — never invented |
| `email`, `phone`, `companyWebsite` | From the enrichment step; only set if a real company was known and a public search actually surfaced something |
| `triggerContext` | The raw comment (or post) text |
| `sourceUrl` | Direct link to the comment/post |
| `pageName` | The Facebook page the interaction happened on |
| `interactionType` | `"commenter"` or `"author"` — in practice only `"commenter"` is ever produced; post-authors are intentionally never treated as leads (see `qualifyPost`'s prompt) |
| `interactionAt` | The real Facebook timestamp of the comment/post (not when we saved it) |
| `intentScore`, `intentReasoning` | From qualification |
| `createdAt` | When we saved it |

Unique index: `(platform, profileId, keyword)` — the same person can become a separate lead under a different keyword, but not twice under the same one.

## API

| Route | Purpose |
|---|---|
| `POST /keywords` | Create a tracked keyword (topic + cron + target Facebook URLs) |
| `GET /keywords` | List tracked keywords |
| `PATCH /keywords/:id` | Edit a keyword (topic, cron, URLs, enable/disable) — reschedules automatically |
| `GET /leads` | List qualified leads, newest first |
| `GET /status` | Health check |

## Running it

```bash
npm install
npm run dev
```

Required/optional environment variables (`.env`):

| Var | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `APIFY_API_TOKEN` | Apify account token (Facebook post/comment scrapers) |
| `GEMINI_API_KEY` | Google Gemini API key (qualification + enrichment) |
| `PORT` | HTTP port (defaults to 3000) |
| `DO_NOT_SEND_API_REQUEST` | Set to `true` to run the pipeline against fixture data (`src/services/DUMMY_DATA.json`) instead of calling Apify/Gemini — for testing without burning quota |
| `LEAD_WEBHOOK_URL` | Optional. If set, every newly saved `Lead` is POSTed as JSON to this URL (e.g. your CRM's webhook endpoint, or Zapier/Make/n8n). Left unset, no webhook call is made. |

Each `Keyword` runs on its own cron schedule; when its cron fires, the full pipeline above runs for that keyword's target URLs.

## Known gaps

- **LinkedIn** — spec calls for it, not built. Facebook (`facebook-posts-scraper` / `facebook-comments-scraper` Apify actors) only.
- **Reactor leads** — only commenters (and, if ever wired up, post authors) can become leads. Nobody who merely reacted to a post is captured — that needs a different Apify actor than the two currently used.
- **Boolean keyword queries** — `keyword` is a single plain-text string matched by individual significant words, not real AND/OR/NOT syntax.
- **Score threshold** — see the note under Pipeline above; currently disabled.
