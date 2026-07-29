# Arsenal Article Artifacts Fix — Session Summary

<!-- Date: 2025-01-TBD -->
<!-- Status: BLOCKED on article URL discovery | Code fixes completed -->

---

## Table of Contents

1. [Objective](#objective)
2. [What Was Fixed ✅](#what-was-fixed--️)
3. [The Blocking Problem ❌](#the-blocking-problem-)
4. [Investigation & Testing Results](#investigation--testing-results)
5. [Code Changes Made](#code-changes-made)
6. [Proposed Solutions](#proposed-solutions)

---

## Objective

Fix Arsenal article hero images and duplicated image rendering on the Harbinger frontend, specifically:

1. **Hero images** were broken — tiny thumbnails or no images showing instead of XL landscape covers
2. **Duplicate images** — hero/content images rendered in both `fullContent` (via `dangerouslySetInnerHTML`) AND in separate containers/grids

The scraper also needed article URL discovery from Arsenal.com listing pages, but the site's Cloudflare WAF now blocks all automated approaches.

---

## What Was Fixed ✅

### 1. Hero Image XL Priority Ranking

**Problem:** Old logic returned the *first* valid image from `__NEXT_DATA__` JSON — often a small thumbnail (e.g., `620x413`) rather than Arsenal's full-size XL landscape hero (`1920x805`).

**Fix:** Implemented preference ranking in `extractArsenalHeroImage()`:
```
Priority 1: /xl_landscape/ URLs
Priority 2: /large_/ URLs  
Priority 3: /xl_square/ URLs
Priority 4: Width-based (>1200px)
Priority 5: og:image fallback
```

**Files Modified:**
- `backend/src/infrastructure/scraper/arsenalBodyParser.ts`
- `backend/src/infrastructure/scraper/arsenalDataParser.ts`

### 2. Removed Duplicate `<img>` Tags from `fullContent`

**Problem:** Arsenal's inline JSON contains HEADER blocks with full `<figure><img src="..."></figure>` that, when inserted into React's `dangerouslySetInnerHTML`, appeared alongside the frontend's own hero container div — showing the same image twice at different sizes.

**Fix:** Stripped raw HTML `<img>` tags from IMAGE/HEADER blocks in `extractArsenalArticleBody()`. Replaced with caption-only text fallback (preserves alt/description). The URL still exists in `article.heroImage` or `contentImages`, rendered separately by the frontend.

### 3. Content Images Deduplication

**Problem:** Same asset appearing in both the top container AND the content grid gallery because it was referenced twice in the source data.

**Fix:** Added to `playwrightScraper.ts`:
```typescript
// Deduplicate via Set
deduplicatedImages = Array.from(new Set(contentImages.map(x => x)));
// Remove heroImage from gallery 
filtered = deduplicatedImages.filter(img => img !== heroImageUrl);
```

### 4. TypeScript Compilation Clean

All parser files compile without errors after refactoring.

---

## The Blocking Problem ❌

After scrubbing the MongoDB database to get fresh data, **the scraper cannot discover any article URLs from Arsenal.com listing pages**. ALL approaches return zero results:

| Strategy | Result | Error / Behavior |
|----------|--------|------------------|
| Playwright headless (Docker container) | ❌ "Access Denied" | Container IP blocked at Cloudflare WAF level |
| Python `requests` + browser headers | ❌ 307 redirect → /404 | Cloudflare challenge on outbound fetch |
| GraphQL API (`afc-prd.graph.arsenal.com/graphql`) | ❌ Schema mismatch | `DateInput`/`PageInput` types not found — likely Apollo-specific CDN cache layer |
| RSS endpoint (`/news/rss.xml`) | ❌ 307 → /404 | Redirected to Cloudflare challenge |
| DOM scraping via `page.evaluate()` | ❌ 0 links on page | Page rendered "Access Denied" before JavaScript hydration |

---

## Investigation & Testing Results

### What Arsenal.com's Architecture Looks Like Now

Testing from host (non-blocked IP) revealed:

1. **SSR Payload:** The server-rendered HTML *does* contain `<script id="__NEXT_DATA__">` with `pageProps`
2. **MegaNav Config:** Contains `article_selector`: `[85375]` for Men's news — this is the article feed ID
3. **Article listing page params:** `{"category": "men", "page": "1"}` — pagination works, but content loads client-side via Apollo
4. **JS chunks:** Next.js dynamic imports load after hydration; article `<a>` tags are not in server HTML
5. **GraphQL endpoint confirmed:** `https://afc-prd.graph.arsenal.com/graphql` EXISTS (200 on introspection)

### GraphQL Schema Discovered

```graphql
# Query type has 85 fields total  
# feeds() field exists with these args:
feeds(seenFeeds: String!): FeedsResponse
# Note: "date" appears required in some CDN responses but DateInput type not available
# This is a CDN-side variant — Apollo-specific types like PageInput, DateInput don't resolve on the public endpoint
```

### Key Finding

**The site's article listing data IS embedded in `pageProps.article.articleBody`**, but:
- Items contain `<img>` tags with relative paths (`cdn-ukwest.onetrust.com`) — not direct URLs
- No absolute `<a href="/news/men-*">` links in server HTML
- Articles load via client-side Apollo after JavaScript executes

---

## Code Changes Made

### New Files Created

| File | Purpose |
|------|---------|
| `backend/src/infrastructure/scraper/arsenalLinkFetcher.ts` | Multi-strategy link discovery (DOM, inline JSON, GraphQL) — **compiles but returns 0 results** due to WAF |
| `backend/debug-chunks.cjs` through `debug-graphql*.mjs/cjs` | Debug scripts used during exploration |
| `backend/discover_graphql.py`, `discover_gql_schema.py`, etc. | Python test harness for GraphQL schema discovery |

### Modified Files

| File | What Changed |
|------|-------------|
| `arsenalBodyParser.ts` | XL priority ranking, removed `<img>` from fullContent |
| `arsenalDataParser.ts` | Same fixes (dual parser architecture) |
| `playwrightScraper.ts` | Stripped stray `<img>`, deduplication logic, getPage visibility |

### Unchanged but Relevant

- **Frontend** (`frontend/app/article/[id]/page.tsx`) — renders hero separately already; needs no changes assuming new data is correct
- **Article schema** (`domains/news/models/Article.ts`) — `heroImage`, `fullContent`, `contentImages` fields unchanged
- **Docker setup** — container IP range blocked by Arsenal's GeoIP + WAF

---

## Proposed Solutions

### Option 1: Manual Seed URLs into MongoDB (Quick Workaround) ✅ RECOMMENDED FOR NOW

```bash
# Step 1: Export listing data from host (non-blocked)  
curl -s "https://www.arsenal.com/news/men" > /tmp/arsenal-men.html

# Step 2: Extract slugs from page JSON  
python3 extract_slugs.py

# Step 3: Seed URLs manually  
mongosh news-aggregator << MONGO
db.articles.insertMany([...])
MONGO

# Step 4: Run scraper against seeded URLs  
curl -X POST http://localhost:8082/api/news/run-scraper
```

**Pros:** Immediate; no infrastructure changes. **Cons:** Manual effort per batch.

### Option 2: Add Residential Proxy to Scraper Stack

Modify Docker Compose or container entry point to route Playwright requests through a residential proxy (e.g., Bright Data, Smartproxy):

```yaml
services:
  backend-api:
    environment:
      - PROXY_URL=http://user:pass@proxy.brightdata.com:3128
    command: >
      node dist/main.js 
      --proxy-url=$PROXY_URL
```

**Pros:** Restores full automated discovery. **Cons:** Adds cost per month; requires proxy account setup.

### Option 3: Pre-Seeded URL Lists Stored in `backend/seeded-urls/`

A JSON file per section listing known good article slugs, used as fallback when live discovery fails:

```json
{
  "Arsenal News": [
    "men-the-holes-story-of-the-midfield-engine-room-f6c08b2e90a",
    "men-summer-transfer-window-review-7d1fca45e3a"
  ],
  "Arsenal Women": ["women-summer-transfers-review-abc123"]
}
```

Scraper checks seed file if discovery returns 0 results.

### Option 4: Use Third-Party Arsenal RSS/API Proxy

Services like:
- `https://feed43.com/arsenal-news.xml` (Feed43, free)  
- NewsAPI.org (paid tier available; may or may not support Arsenal-specific feeds)

**Pros:** Offloads WAF evasion. **Cons:** Rate limits, reliability, and cost.

---

## File Paths Reference

All paths relative to `J:/Work/Harbinger/`:

```
backend/
├── src/infrastructure/scraper/
│   ├── arsenalBodyParser.ts       ← MODIFIED: XL ranking + <img> stripping  
│   ├── arsenalDataParser.ts       ← MODIFIED: same fixes
│   ├── arsenalLinkFetcher.ts      ← NEW (compiles, blocks at runtime)
│   └── playwrightScraper.ts       ← MODIFIED: dedup, visibility
├── discover_gql_schema.py         ← Debug script (unused going forward)
└── discovered_graphql.txt         ← Notes from investigation

frontend/
├── app/article/[id]/page.tsx      ← Hero renders separately; no changes needed
└── features/feed/types.ts          ← Article model unchanged

docker/
└── docker-compose.yml              ← No changes to proxy/additional services
```

---

## Next Action Required

**Waiting for user decision on which solution path to pursue.**

The code is ready and compiles. Once article URLs can be discovered or seeded, the scraper will:
1. Fetch each page
2. Parse `__NEXT_DATA__` → extract heroImage, fullContent, contentImages
3. Store in MongoDB
4. Frontend renders XL hero images correctly without duplicates

