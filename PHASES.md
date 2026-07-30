# Implementation Checklist

## Phase 1: Foundation [✅ COMPLETE]

- [x] `docker-compose.yml` — 3 services: mongodb, backend-api, frontend-app + networks/volumes
- [x] Backend directory scaffold (Clean Architecture structure)
- [x] Dockerfile for backend (Playwright deps)
- [x] Multi-stage Dockerfile for frontend
- [x] `.env.example` with all variables (MongoDB, JWT, Admin bootstrap, OAuth, CORS ports)
- [x] `DEVELOPMENT.md` — local dev setup instructions, troubleshooting guide

**What this gives you:** Run `docker compose up --build`, hit `localhost:3000`, press a button. Zero functionality but the stack is wired end-to-end.

---

## Phase 2: Authentication [✅ COMPLETE]

### Backend
- [x] Express skeleton with health route (`GET /api/health`)
- [x] Mongoose connection setup (`infra/repositories/mongoConn.ts`)
- [x] `users` collection schema (per `specs/api-auth.md §3`)
- [x] Admin bootstrap middleware — seeds admin account on first boot (uses `ADMIN_USER`/`ADMIN_PASS`)
- [x] JWT service (`infra/auth/jwtService.ts`) — HS256 signing, 30-day expiry
- [x] Passport strategy configs:
  - [x] `passport-google-oauth20` → `/api/auth/google/callback`
  - [x] `passport-apple` → `/api/auth/apple/callback`
  - [x] `passport-facebook` → `/api/auth/facebook/callback`
- [x] Login initiation route — `POST /api/auth/:provider` returns OAuth URL (full-page redirect flow)
- [x] Callback handlers — exchange code for profile, create/update user in Mongo, sign JWT
- [x] `checkRole("ADMIN")` middleware (`infra/middleware/adminCheck.ts`)

### Frontend
- [x] Next.js app scaffold + Tailwind config (`tailwind.config.ts`, `_app.tsx`)
- [x] `next-themes` config for dark/light mode (per `specs/frontend-ui.md §2.A`) — provider wired with `attribute="class"` and `defaultTheme="system"`, so the OS preference is honoured. The user-facing toggle is [Phase 5b](#phase-5b-dark--light-mode-toggle--todo).
- [x] Login page UI — centered card with 3 social buttons (`features/auth-feature/ui/AuthButtons.tsx`)
- [x] API client wrapper (`shared/api/client.ts`) — singleton fetch, JWT injection, error mapping to `{success,data,error}` response format
- [x] AuthContext with three states: authenticated, guest, anonymous
- [x] OAuth URL param handler — auto-login when redirected from callback

**What this gives you:** Users can log in with Google/Apple/Facebook, get a JWT token, and hit protected routes. Verified via curl or Postman — no UI polish yet.

> **Note:** Apple and Facebook require separate developer console setup. See `OAUTH_SETUP.md` for step-by-step instructions.

---

## Phase 2b: Guest Mode [✅ COMPLETE]

### Backend
- [x] `jwtService.ts` — `signGuestToken()` issues HS256 token with `role: 'GUEST'`, `expiresIn: '7d'`
- [x] `POST /api/auth/guest` route (`domains/auth/routes/guest.route.ts`)
    - Creates/upserts a User doc with `provider: 'guest'`, unique UUID v4
    - Returns `{ token, expiresAt }`
- [x] Update auth middleware to allow `GUEST` role on read-only routes (`/api/news*`, `/api/articles*`)
    - `optionalAuth(allowGuestOn?)` guard for public-but-preferred-auth endpoints
    - `checkRole` returns 403 with guest-specific message for bookmarks
- [x] Bookmarks endpoints return `403` + guidance message for `GUEST` role users (vs. `401` for unauthenticated)

### Frontend
- [x] `AuthContext.tsx` — tracks three states: authenticated (`USER`/`ADMIN`), guest (`GUEST`), anonymous (no token)
- [x] `(public)/page.tsx` — "Continue as Guest" button; **always** renders the feed grid regardless of auth state
- [x] `api/client.ts` — public endpoints do not redirect on 401; only bookmark/admin calls trigger login redirect
- [x] Login page (`LoginCard.tsx`) — "Continue as Guest" option alongside social buttons
- [x] Upgrade prompt component (`UpgradePrompt.tsx`) — modal shown when guest attempts bookmark or protected action
- [x] Navbar — shows "Guest" indicator (indigo badge with User icon) with Upgrade link

**What this gives you:** Anyone can browse the feed immediately. No OAuth providers needed to access content. Guests who want bookmarks get a smooth upgrade path.

---

## Phase 3: Scraping Engine ✅ COMPLETE

### Backend
- [x] `IScraperStrategy` interface (`domains/news/interfaces/`)
- [x] Playwright scraper adapter (`infra/scraper/playwrightScraper.ts`)
- [x] Content cleaner — strips `<script>`/`<style>`, normalizes dates to ISO 8601, resolves relative image URLs (per `specs/backend-scrapper.md §2.E`)
- [x] User agent rotation middleware
- [x] Extraction pipeline use-case (`domains/news/services/newsService.ts`) — orchestrates Source Retrieval → Navigation → Link Discovery → Deep Scraping → Cleaning → Upsert (matches `PRD.md §3.A` exactly)
- [x] Sources collection schema (`specs/backend-scrapper.md §3`)
- [x] Articles collection schema + validation
- [x] Request throttling — random 1–5s delay between scrapes, max 3 concurrent pages
- [x] Cron job with `node-cron` — every 60 minutes, fetches active sources from DB

**What this gives you:** Mongo has article documents. Verify by querying `db.articles.find()` directly — no HTTP endpoints exist yet.

### Tests
- [x] Unit tests: contentCleaner (12), urlResolver (9), throttler (5), userAgentPool (4), playwrightScraper (6), newsService (4) = **40/40 passing** (suite has since grown to 134 backend + 11 frontend)
- [x] Vitest config with path aliases (`backend/vitest.config.ts`)

### Infrastructure
- [x] Dockerfile already includes `npx playwright install --with-deps chromium`
- [x] Dependencies installed: playwright, node-cron, cheerio, vitio

---

## Phase 4: API Endpoints [✅ COMPLETE]

### All endpoints (per `specs/api-endpoints.md`)
- [x] **Public News**
  - [x] `GET /api/news` — paginated article list with standard response wrapper (limit-offset pagination). Also returns `pageSize`; `page`/`limit` are clamped (max 100/page) so a negative page cannot produce a negative skip and one request cannot read the whole collection
  - [x] `GET /api/news/:id` — full article with hero image, contentImages[], fullContent, plus `summary` and `sourceName`
  - [x] `GET /api/news?source=<id>` — filter the feed to one source (rejects an unrecognised id rather than returning everything)
  - [x] `GET /api/news/sources` — active sources that have articles, for building feed filters
- [x] **Bookmarks (requires JWT)** — mounted at `/api/bookmarks`, guarded by `authMiddleware` + `checkRole(['USER','ADMIN'])`
  - [x] `POST /api/bookmarks` — `{articleId}` in the body, returns 201, idempotent
  - [x] `GET /api/bookmarks` — user's saved articles, same paginated envelope as `GET /api/news`
  - [x] `DELETE /api/bookmarks/:id` — remove bookmark (404 when not bookmarked)
  - [x] `DELETE /api/bookmarks` — clear all
  - [x] `GET /api/bookmarks/ids` — just the bookmarked ids, so the feed can mark cards without fetching every article
- [x] **Admin Sources (requires ADMIN role)**
  - [x] `GET /api/admin/sources`
  - [x] `POST /api/admin/sources` — add source (selectors required only for the `generic` adapter)
  - [x] `PUT /api/admin/sources/:id`
  - [x] `DELETE /api/admin/sources/:id`
  - [x] `PATCH /api/admin/sources/:id/toggle` — flip `isActive`
  - [x] `POST /api/admin/sources/test` — live test endpoint that spins up a temporary Playwright instance with the provided configuration
  - [x] `POST /api/admin/sources/run-scraper` — trigger the pipeline manually
  - [x] `GET /api/admin/sources/adapters` — available adapters and whether each needs CSS selectors
  - [x] `GET /api/admin/sources/scrape-runs` — paginated history of scrape runs
- [x] Global error handler — every failure returns `{success,data,error}` with the codes from `specs/api-endpoints.md §6` (401 for a missing/invalid token, 403 for authenticated-but-unprivileged)
- [x] Route tests (`vitest` + `supertest`) — 67 tests covering auth codes per verb, pagination and clamping, source filtering, validation, cross-user isolation, and 500 propagation

**What this gives you:** Every route in `specs/api-endpoints.md` working, with automated coverage rather than only manual curl. Standard response wrapper (`{success,data,error}`) applied everywhere, including error paths.

> **Known gap (tracked in Phase 6):** there is no way to *obtain* an ADMIN token
> through the app — auth is OAuth-only and the bootstrapped admin account has no
> login route. The admin endpoints are correct and tested, but currently
> unreachable without minting a JWT by hand.

---

## Phase 5: Frontend Public Pages [🟡 MOSTLY DONE]

- [x] Next.js App Router pages scaffold:
  - [x] `(public)/page.tsx` — Home/Feed page
  - [x] `article/[id]/page.tsx` — Article detail view
  - [~] Layout structure with nav bar (`features/ui/Navbar.tsx`) — logo and login/profile present; **dark mode toggle missing** (see [Phase 5b](#phase-5b-dark--light-mode-toggle--todo))
- [x] Shared UI primitives (`shared/ui/`) — `Button`, `Card`, `Input`
- [~] Data fetching:
  - [ ] Server Components for initial page data loads (per `PRD.md §6.B RSC rules`) — **not done**: both pages are `"use client"` and fetch via SWR, so the first paint is a skeleton rather than server-rendered content. Worth revisiting for SEO on the article page
  - [x] SWR hooks (`features/feed/useNewsFeed.ts`) for cached navigation, with `keepPreviousData` so paging does not flash back to skeletons
  - [x] Skeleton loading states (gray pulsing placeholders, per `specs/frontend-ui.md §4.B`)
- [x] News grid — responsive CSS grid (4 cols desktop, 3 laptop, 2 tablet, 1 mobile)
- [x] Article tile component (thumbnail image + title + summary + source + date, hover zoom effect)
- [x] Article detail page — hero image, rendered HTML content, back-to-feed button
- [x] Feed pagination — 20 per page, page numbers with ellipses, prev/next, "showing X–Y of Z"
- [x] Source filter pills — derived from `GET /api/news/sources`, so a new source adds its own filter with no frontend change

**What this gives you:** Visually browse and page through articles, filtered by
source. Skeleton loading states per spec. Fully responsive across breakpoints.

---

## Phase 5b: Dark / Light Mode Toggle [✅ COMPLETE]

`next-themes` was already wired with `attribute="class"` and `defaultTheme="system"`,
so the OS preference was honoured — but nothing let a user override it, and
neither appearance had been checked.

- [x] `ThemeToggle` (`features/theme-feature/ui/ThemeToggle.tsx`) — cycles light → dark → system, persisted by `next-themes`. `system` is kept as an explicit choice, not just an initial default, so a user can get back to following their OS
- [x] Renders a same-size placeholder until mounted, since `next-themes` only knows the real theme on the client and would otherwise flash the wrong icon
- [x] Mounted in the nav bar, available signed in or not
- [x] Removed the hardcoded `className="light"` on `<html>` — it made light the flash-of-wrong-theme colour for anyone resolving to dark
- [x] Contrast audited against WCAG AA across both themes on the feed, article page, login, bookmarks, admin dashboard and scrape logs — **0 failures remaining**

Fixed by the audit:
- [x] Card meta strip (source · date) used `text-slate-400`, only **2.56:1** on white. Now `text-slate-500 dark:text-slate-400`
- [x] Source filter count badge sat just under AA in both themes (4.34 light / 4.04 dark). Bumped one step each way
- [x] Scrape log "needing attention" used `amber-600`, **3.19:1** on white. Now `amber-700 dark:text-amber-400`

> **The predicted risk did not materialise.** Scraped article HTML was expected to
> carry inline colours that `prose-invert` cannot override. It does not: across
> all 40 stored articles there are 2 `style=` attributes and **zero** colour
> declarations, `<font>` tags or background colours — the parsers never emit them.
> The article page audits clean in both themes.

**What this gives you:** A user-controllable theme switch, with both appearances
measured rather than assumed.

---

## Phase 6: Protected + Admin UI [🟡 IN PROGRESS]

### Admin source management [✅ DONE]
- [x] **Admin sign-in** — `POST /api/auth/login` verifies `passwordHash` against `provider: 'local'` accounts and issues a role-bearing token. Unblocks the whole phase: `ADMIN_USER`/`ADMIN_PASS` seed an admin, but OAuth can never reach it, so the Phase 4 admin endpoints previously needed a hand-minted JWT. Failures are indistinguishable between unknown account and wrong password, and the route has its own rate limit (10 per 15 min)
- [x] Credential form on the login page (`features/auth/ui/CredentialLoginForm.tsx`) — collapsed by default so social stays primary; routes admins to `/admin` on success
- [x] Auth state tracks `role`, exposing `isAdmin` (`features/auth/lib/AuthContext.tsx`)
- [x] `AdminGuard` route wrapper (`features/admin/ui/AdminGuard.tsx`) — distinguishes "sign in required" from "admin only", and waits for the localStorage restore so a signed-in admin never sees a false denial
- [x] Admin dashboard (`app/(admin)/admin/page.tsx`):
  - [x] Sources table — name, display name, URL, adapter, limit, status, date added
  - [x] Source editor form with validation (URL format, limit range, selectors required only when the adapter needs them)
  - [x] Adapter picker driven by `GET /api/admin/sources/adapters`; the CSS selector block appears only for `requiresSelectors` adapters
  - [x] `displayName` and `articleLimit` fields
  - [x] "Test Scrape" → `POST /api/admin/sources/test` → preview of title, hero image, summary, character count
  - [x] Toggle active/inactive, and delete behind a confirm step
  - [x] "Run scraper now" → `POST /api/admin/sources/run-scraper`
- [x] `Admin` link in the nav bar, shown only to admins
- [x] `Input` primitive (`shared/ui/Input.tsx`) — label, hint, error, `aria-invalid`/`aria-describedby`

> Verified end to end through the UI: signed in as admin, added a brand-new
> source (Rust Blog) with selectors the registry had never seen, ran Test Scrape
> against a real article, saved, toggled inactive and back, then deleted it.

### Bookmarks page [✅ DONE]
- [x] `app/bookmarks/page.tsx` — grid with unsave action, paginated against `GET /api/bookmarks`
- [x] `BookmarksContext` above the router as the single source of truth, so bookmark state survives navigation between the feed, an article and this page

### Toast notifications [✅ DONE]
- [x] Sonner container mounted in `Providers`, helpers in `features/ui/toast.ts`
- [x] Wired into bookmark actions (via `BookmarksContext`, so every surface reports identically), admin create/update/delete/toggle, and a loading toast for the duration of a manual scrape
- [x] Convention: transient action results toast; persistent state (form validation, load failures) stays inline

### System Logs [✅ DONE]
- [x] `scraperuns` collection recording every run — trigger (`boot`/`cron`/`manual`), status, duration, per-source counts and errors
- [x] Written from the single choke point in `scraperCron.runOnce`, so all three triggers are covered, failures included. A logging failure can never take the scrape down
- [x] TTL index expires runs after `SCRAPE_LOG_RETENTION_DAYS` (default 30) — an hourly cron writes ~720 documents a month
- [x] `GET /api/admin/sources/scrape-runs` — paginated, ADMIN only
- [x] `/admin/logs` — run table with expandable per-source detail, auto-refreshing every 30s
- [x] A source that discovers **zero links** is flagged as degraded even though it raises no error. That is precisely how a silently broken adapter presents, and it is what went unnoticed with Arsenal

### Remaining
- [ ] Sidebar navigation, Dashboard → Sources → System Logs (`specs/admin-panel.md §4`) — now worth doing, since there are two real destinations to move between
- [x] Dark mode toggle — see [Phase 5b](#phase-5b-dark--light-mode-toggle--complete)

**What this gives you:** An administrator can sign in, manage scraping sources
entirely through the UI — add, test, edit, activate and delete — and see what the
scraper actually did on every run, including which sources are failing. Users can
save articles and revisit them from a dedicated page.

---

## Parallel Execution Summary

| Phase | Can run in parallel? | Depends on |
|---|---|---|
| 1 (Foundation) | No — base layer | None |
| 2 (Auth + Guest) | ✅ Yes, with Phase 3 | Mongoose users collection ✓ |
| 2b (Guest Mode) | ✅ Yes, with Phase 2 & 3 | Auth infra from Phase 2 ✓ |
| 3 (Scraper) | ✅ Yes, with Phase 2 | Mongoose articles/sources collections ✓ |
| 4 (API Endpoints) | No | Phase 2 (auth middleware), Phase 3 (data) |
| 5 (Frontend Pages) | ✅ Yes, with Phase 4 | Frontend skeleton from Phase 1 ✓ |
| 5b (Dark / Light Mode) | — done | Surfaces to audit exist (Phase 5) ✓ |
| 6 (Auth + Admin UI) | No | Phases 4 & 5 complete |
| 6a (Admin source management) | — done | Phase 4 admin endpoints ✓ |

**Critical path:** 1 → 2 → 2b → 3 → 4 → 5 → 6 (5b can land any time after 5)
**Ways to speed up:** Implement phases 2 and 3 in parallel since neither depends on the other. Start frontend pages (phase 5) while phase 4 routes are still being built — mock API responses first, wire to real endpoints later.
