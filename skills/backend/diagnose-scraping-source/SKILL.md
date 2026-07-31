---
name: diagnose-scraping-source
description: Investigate and fix a news source that returns no articles, or add a new one. Covers deciding between feed, sitemap, selector and bespoke-adapter routes, diagnosing blocks and client-side rendering, and writing a new adapter for the Harbinger scraper.
---

# Diagnosing a Scraping Source

Use this when a source returns zero articles, an operator reports "adding site X
fails", or a new source needs adding and the obvious approach does not work.

Three sources have already been fixed this way — Arsenal, RSI Comm-Link and
TechPowerUp. Their case notes are at the end; read them before investigating a
new site, because the failure modes repeat.

---

## The one rule that matters most

**Find out what the site offers before you try to scrape it.**

Every source that took a long investigation was solved by a route the site
publishes deliberately — a sitemap, a feed — that was found late. Scraping HTML
with CSS selectors is the *last* resort, not the first attempt.

Order of preference:

| Route | Why | Adapter |
| :--- | :--- | :--- |
| **RSS / Atom feed** | Structured content, survives redesigns, one request per run, often works when scraping is blocked | `rss` |
| **Sitemap** | Reliable discovery even when listing pages render client-side | `sitemap` |
| **CSS selectors** | Works anywhere, breaks silently on redesign | `generic` |
| **Bespoke adapter** | Only when the site's structure defeats all of the above | new file |

Start here, and most investigations end in one call:

```bash
GET /api/admin/sources/discover-feeds?url=<site>
```

Returns feeds, sitemaps and a recommended adapter. If it finds something, you're
probably done — configure the source and test it.

---

## Investigation procedure

### 1. Reproduce, and read the diagnostics

Never guess at selectors. The test endpoint reports what the scraper actually
saw:

```bash
POST /api/admin/sources/test
  { "url": "<article url>", "adapter": "generic", "contentSelector": "..." }
```

The response carries `ok`, a plain-language `reason`, and `diagnostics`:
`pageTitle`, `renderedChars`, `visibleTextChars`, `botChallengeDetected`,
`accessBlocked`, `paragraphCount`, `selectorMatches`, `fetchError`.

`pageTitle` alone usually settles it. `403 - Access Denied` means no selector
will ever work.

### 2. Establish *where* it fails — these are different problems

- **Discovery** — finding article URLs from a listing page
- **Article parsing** — extracting content from one article page

A site can fail at one and not the other. Arsenal's discovery was broken while
its article parsing was fine.

### 3. Work out how the site responds to each access method

Sites differ, and **the two methods are not interchangeable**:

```bash
# plain HTTP
curl -s -o /dev/null -w "%{http_code}" -A "<real UA>" <url>

# headless browser, from inside the container
docker exec harbingbackend sh -c 'cd /usr/src/backend && node probe.mjs'
```

Observed behaviour so far:

| Site | Plain fetch | Headless render |
| :--- | :--- | :--- |
| Arsenal | ✅ works | ❌ "Access Denied" |
| TechPowerUp | ❌ bot-check page | ❌ 403 |
| RSI Comm-Link | ✅ listing only | ✅ needed for article body |

**Always test from inside the container.** Your own browser has a different IP
and fingerprint and will give different answers — a site can render perfectly for
you and 403 the server.

### 4. If blocked, do not conclude "unscrapeable" from one attempt

Test the variants before deciding — longer wait, realistic headers, fingerprint
masking. If all return the same status immediately, it is an IP-reputation block
and no client-side change will defeat it.

**Then go looking for a feed.** A site that blocks scrapers very often still
publishes one — that is exactly the TechPowerUp outcome, and concluding
"needs a residential proxy" before checking was wrong.

### 5. If the page loads but yields nothing

Check, in order:

1. **Is the listing client-rendered?** Count anchors after render. Zero links on
   a news homepage means the cards are drawn by JavaScript from an API — look
   for a sitemap or feed instead of fighting it.
2. **Is the content embedded as JSON?** Next.js sites carry
   `<script id="__NEXT_DATA__">` with the full article in `props.pageProps`.
   Parsing that is far more robust than selectors.
3. **Is the body split across several blocks?** Taking only the first match
   silently truncates. Concatenate every match.
4. **Are half the "articles" not articles?** Store/promo/landing pages in a news
   listing must be skipped, not stored empty.
5. **Is the only long text the cookie banner?** A density heuristic will happily
   pick consent text. Exclude consent/nav chrome explicitly.

---

## Adding a new adapter

Only when feed, sitemap and selectors have all been ruled out.

1. Create `backend/src/infrastructure/scraper/adapters/<name>Adapter.ts`
   implementing `ISourceAdapter` — `descriptor`, `discoverLinks`, `parseArticle`.
2. Register it in `adapters/index.ts` (ordered by durability: feed, sitemap,
   selectors).
3. Add unit tests. Adapters receive an `AdapterContext`, so they test against a
   stubbed `{ fetchHtml, renderHtml }` with no network.
4. Add a live test to `tests/adapters.live.test.ts`, gated behind
   `SCRAPER_LIVE_TESTS=1`.

**Never call Playwright directly.** Ask the context for `fetchHtml` (plain HTTP)
or `renderHtml` (headless). This keeps adapters testable and means a browser
launches only when something needs one.

Set `requiresSelectors: false` unless the adapter genuinely consumes CSS
selectors — it drives whether the admin form demands them.

---

## Verifying a fix

Do all four. A source can pass one and fail the next.

```bash
# 1. Unit + contract tests
cd backend && npx vitest run

# 2. Live adapter tests
SCRAPER_LIVE_TESTS=1 npx vitest run tests/adapters.live.test.ts

# 3. Full pipeline
POST /api/admin/sources/run-scraper

# 4. Data quality — the check that catches silent breakage
db.articles.countDocuments({ $or: [{fullContent: ""}, {summary: ""}, {heroImage: null}] })
```

Then read the scrape log (`/admin/logs`). **A source discovering zero links is
recorded as degraded even with no error** — that is how a silently broken
adapter presents.

---

## Case notes

### Arsenal — client-rendered listing, JSON article payload

- **Symptom:** discovery returned zero links; the whole feed was empty.
- **Two causes.** The link regex expected `/news/<word>-<Word>`; real URLs are
  `/news/kebab-case-title-a1B2c3D4e5F6`. And listing pages render client-side —
  Playwright saw **0 anchors**, not even navigation.
- **A prior investigation blamed a Cloudflare WAF block. That was wrong** —
  `arsenal.com` returns 200 from inside the container. Verify a claimed block
  yourself before building around it.
- **Fix:** discovery from `https://www.arsenal.com/sitemaps/articles/sitemap.xml`
  — 653 URLs sorted newest-first in ~480ms, no browser. Article content comes
  from `__NEXT_DATA__` → `props.pageProps.article`, where `promoImage` is already
  an `xl_landscape` URL and `articleBody` is typed blocks (`HEADER`, `TEXT`,
  `IMAGE`, `LIST`) whose `html` field is ready to use.
- **Trap:** section filtering by URL does not work — `-men-` matches **0 of 653**
  URLs. Section lives in `taxonomySlugs` inside the payload. One source covers
  all sections.
- **Trap:** Arsenal serves plain HTTP fine but answers headless Chrome with
  "Access Denied" — the reverse of the usual assumption.

### RSI Comm-Link — mixed templates, split bodies

- **Symptom:** articles showed a hero image and title but no body.
- **Cause:** the source pointed at the Community Hub, whose posts are
  user-submitted screenshots with `body: ""`. The content heuristic then latched
  onto the only long text on the page — the **cookie banner**.
- **Fix:** switched to `/comm-link`, the official news channel. Listing is
  server-rendered (cards are `a.content-block2`, carrying title, thumbnail,
  excerpt and a relative date); article bodies are hydrated client-side, so they
  need a render.
- **Trap:** an article body spans **several sibling `.g-article__body` blocks**.
  Taking the first truncates most posts.
- **Trap:** roughly **6 in 10** Comm-Link posts are store/promo pages on a
  different template with no prose. Skip them; do not store empty articles.
- **Trap:** `og:title` is often a section heading ("COMMUNITY MVP"). The listing
  card title is the better source.

### TechPowerUp — hard block, open feed

- **Symptom:** "Failed to scrape the provided URL with the given configuration",
  with nothing in the scrape logs (test scrapes are not pipeline runs).
- **Cause:** every page request returns **403** to the server. Four variants
  tested — 2s wait, 15s wait, realistic headers, fingerprint masking — all
  identical, immediately. IP-reputation block.
- **The mistake to avoid:** concluding "not scrapeable without a residential
  proxy". Its `/rss/news` feed returns **200 with 113 items**, unblocked.
- **Fix:** the `rss` adapter, reading everything from the feed and never
  fetching the page.

---

## Environment notes

- Containers: `harbingbackend`, `harbingfrontend`, `harbingermongo`. Backend
  workdir is `/usr/src/backend`.
- Rebuild after changes — `docker compose build backend-api && docker compose up -d backend-api`.
  Changing backend code and rebuilding only the frontend is an easy way to spend
  ten minutes debugging a fix that was never deployed.
- Admin token: `POST /api/auth/login` with `ADMIN_USER` / `ADMIN_PASS`.
- Git Bash mangles absolute paths in `docker cp`/`docker exec`. Prefix with
  `MSYS_NO_PATHCONV=1`, and use `sh -c 'cd /path && node file'` rather than
  `-w /path`.
- **Feed richness varies and is worth measuring:** Ars Technica ~2,200 chars per
  item, TechPowerUp ~2,060, The Verge ~1,560, **BBC News ~104** — a headline and
  a sentence. A thin feed may be worse than scraping the page. Test before
  committing to it.
