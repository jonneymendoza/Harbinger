# Feature Specification: Backend Scraping Engine

## 1. Architecture Context

This document specifies the scraping engine, which is a domain module within the backend's **Clean Architecture (Hexagonal / Ports & Adapters)** pattern. The scraper exists entirely within `domains/` and `infrastructure/` layers described in `PRD.md §6.A`:

- **`domains/news/interfaces/IScraperStrategy.ts`** — Port (interface) defining the contract for scrapers
- **`infrastructure/scraper/`** — Adapters implementing the port (Playwright implementation)
- **`domains/news/newsService.ts`** — Use case class orchestrating the extraction pipeline

### Architecture Rules
- The scraper use-case depends only on `IScraperStrategy`, not on Playwright directly.
- All repository writes go through interfaces in `domains/*/interfaces/`. The news controller and scraper service depend only on these contracts, never on Mongoose.
- Routes live in `domains/*/route.ts` (Express routers) — thin layers that parse requests and delegate to services.

---

## 2. Overview
The Scraping Engine is responsible for the autonomous discovery, extraction, and cleaning of news articles from target sources defined in the database. It converts raw HTML into a structured JSON snapshot stored in MongoDB.

## 2. Technical Implementation

### A. Technology Stack
*   **Runtime:** Node.js
*   **Browser Automation:** Playwright (Headless) — used only where a source needs it
*   **Feed Parsing:** RSS 2.0 and Atom, via the `rss` adapter
*   **Scheduler:** `node-cron`
*   **Database:** MongoDB

### B. The Extraction Pipeline
The engine will execute the following flow every 60 minutes:

1.  **Source Retrieval:** Fetch all entries from the `sources` collection where `active === true`.
2.  **Target Navigation:** For each source, navigate to the provided base URL using a Playwright browser instance.
3.  **Link Discovery:** Identify and extract links to individual articles based on CSS selectors stored in the `source` document.
4.  **Deep Scraping:** For each new article link discovered:
    *   Navigate to the article page.
    *   Wait for network idle (to ensure JS-heavy content is rendered).
    *   Extract:
        *   **Hero Image:** The primary high-res image used as a banner.
        *   **Thumbnail:** A smaller version of the image for tile views.
        *   **Full Content:** All `<p>` and `<img>` tags within the main article body, converted to cleaned HTML/JSON.
        *   **Embedded Images:** An array of all images found within the content area.
        *   **Metadata:** Title, Publication Date, Category.
5.  **Data Cleaning:** 
    *   Strip scripts, styles, and irrelevant ads from content.
    *   Normalize dates to ISO 8601 format.
    *   Ensure absolute URLs for all images (prepend base domain if relative).
6.  **Upsert into DB:** Use an `upsert` operation based on the source URL to avoid duplicate articles.

### C. Source Adapters

Scraping strategy is resolved per source from its `adapter` field, so a source
can be added at runtime without a code change. Adapters implement
`ISourceAdapter` (`discoverLinks` + `parseArticle`) and receive an
`AdapterContext` offering `fetchHtml` (plain HTTP) and `renderHtml` (headless
render). They never touch Playwright directly, which keeps each one unit-testable
against a stubbed context and means Chromium is launched only when something
actually asks to render.

| Adapter | Discovery | Article body | Selectors |
| :--- | :--- | :--- | :--- |
| `rss` | Feed items | The feed's own content — the page is never fetched | None |
| `generic` | `articleLinkSelector` on the listing page | `contentSelector` | Required |
| `arsenal` | Published articles sitemap | `__NEXT_DATA__` payload | None |
| `rsi-commlink` | Server-rendered listing cards | `.g-article__body` after render | None |

**Prefer `rss` wherever a feed exists.** It needs no selectors, survives markup
changes, costs one request per run rather than one per article, and works on
sites that block automated access to their HTML while publishing a feed —
TechPowerUp returns 403 to every page request from the server while serving 113
feed items happily.

A site warrants its own adapter when it is client-rendered, embeds content as
JSON, is driven by a sitemap, or mixes articles with non-article pages. Adding
one is a single file plus a registry line.

#### Feed discovery

Given a site URL, the engine probes for feeds: the page's declared
`<link rel="alternate">` tags first, then a list of common paths. Every candidate
is fetched and parsed before being reported, so a path that returns 200 HTML for
a missing feed is rejected rather than offered. The path fallback runs even when
the page itself is refused, which is how a blocked site's feed is still found.

Discovery reports candidates; it does not choose. Most sites publish several
feeds — news, reviews, per-article comments — so selection is left to the
operator (`specs/admin-panel.md §3.B`).

> **Feed richness varies, and it is worth checking.** Measured: Ars Technica
> ~2,200 chars per item, TechPowerUp ~2,060, The Verge ~1,560 — but BBC News
> ~104, a headline and one sentence. A teaser-only feed still yields a valid card
> linking to the original, but not a readable article body. Test before saving.

### D. Run History

Every pipeline execution is persisted to `scraperuns`: trigger (`boot` / `cron` /
`manual`), status, start, finish, duration, articles added, and a per-source
breakdown of links discovered, articles added, already-stored, rejected as
non-articles, and errors.

A run is `partial` when any source is degraded and `failed` when all are.
**A source discovering zero links counts as degraded even though it raises no
error** — that is precisely how a silently broken adapter presents, and treating
it as success would defeat the purpose of recording runs at all.

Recording happens in a `finally` and swallows its own failures: logging must
never take a scrape down with it. A TTL index expires records after
`SCRAPE_LOG_RETENTION_DAYS` (default 30), since an hourly cron writes ~720
documents a month.

## 3. Database Schemas

### Source Collection (`sources`)
```json
{
  "_id": "ObjectId",
  "name": "String — internal identifier (e.g. Arsenal News)",
  "displayName": "String — label shown on the public feed filter; defaults to name",
  "baseUrl": "String — listing page, or the feed itself for the rss adapter",
  "adapter": "String — rss | generic | arsenal | rsi-commlink (default: generic)",
  "articleLimit": "Number — optional per-source override of SCRAPER_ARTICLE_LIMIT",
  "articleLinkSelector": "String — generic adapter only",
  "contentSelector": "String — generic adapter only",
  "titleSelector": "String — generic adapter only",
  "imageSelector": "String — generic adapter only",
  "isActive": "Boolean",
  "createdAt": "Date"
}
```

### Article Collection (`articles`)
```json
{
  "_id": "ObjectId",
  "sourceId": "ObjectId (Reference to sources)",
  "sourceUrl": "String (Unique Index)",
  "title": "String",
  "heroImage": "String (URL)",
  "thumbnailImage": "String (URL)",
  "contentImages": ["String"], 
  "fullContent": "String (Cleaned HTML/Markdown)",
  "summary": "String",
  "category": "String",
  "publishedAt": "Date",
  "scrapedAt": "Date"
}
```

### Scrape Run Collection (`scraperuns`)
```json
{
  "_id": "ObjectId",
  "trigger": "String (boot | cron | manual)",
  "status": "String (success | partial | failed)",
  "startedAt": "Date",
  "finishedAt": "Date",
  "durationMs": "Number",
  "totalArticlesAdded": "Number",
  "results": [
    {
      "sourceId": "ObjectId | null",
      "sourceName": "String",
      "linksDiscovered": "Number",
      "articlesScraped": "Number",
      "articlesSkipped": "Number (already stored)",
      "articlesRejected": "Number (fetched but not an article)",
      "errors": ["String"]
    }
  ],
  "error": "String | null (set when the pipeline itself threw)"
}
```
TTL index on `startedAt`, expiring after `SCRAPE_LOG_RETENTION_DAYS` (default 30).

## 4. Resiliency & Anti-Block Measures
*   **User Agent Rotation:** cycle through a list of common browser user agents to avoid fingerprinting.
*   **Request Throttling:** Implement a random delay (1–5 seconds) between individual article scrapes.
*   **Headless Mode:** Run in headless mode for performance on the TrueNAS/AWS server, but allow headful mode for local debugging.
*   **Error Handling:** If a specific source fails to scrape, log the error and proceed to the next source without crashing the entire process.
*   **Blocked Sources:** Some sites refuse automated access outright, returning a 403 or a bot-check interstitial regardless of user agent, headers, wait time or fingerprint masking. This is an IP-reputation decision and no client-side change defeats it. Where such a site publishes a feed, use the `rss` adapter — that is the access route the site actually offers.

## 5. Performance Considerations
*   **Concurrency:** Limit the number of concurrent browser pages (e.g., max 3 open pages) to avoid memory spikes on low-resource hardware.
*   **Caching:** Only scrape articles that aren't already in the DB or those whose "Last Modified" header has changed.
*   **Article Limits:** `SCRAPER_ARTICLE_LIMIT` (default 20) caps how many of the newest articles are *considered* per source per run — a ceiling on candidates, not on inserts, since already-stored URLs are skipped. A per-source `articleLimit` overrides it, which matters where a listing mixes articles with other page types: RSI Comm-Link is ~45% articles, so it needs 45 candidates to yield roughly 20.
*   **Request Cost:** The `rss` adapter makes one request per run regardless of article count, since the feed carries the bodies. Selector- and render-based adapters cost one page load per article.
