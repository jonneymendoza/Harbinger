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
- [x] Unit tests: contentCleaner (12), urlResolver (9), throttler (5), userAgentPool (4), playwrightScraper (6), newsService (4) = **40/40 passing**
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
- [~] Shared UI primitives (`shared/ui/`) — `Button` and `Card` done; **`Input` not built yet** (first needed by the Phase 6 admin source form)
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

## Phase 5b: Dark / Light Mode Toggle [🔴 TODO]

> More of this works than it appears. `next-themes` **is** wired in
> `app/providers.tsx` with `attribute="class"` and `defaultTheme="system"`,
> Tailwind uses the `class` strategy, and components carry `dark:` variants
> throughout. Verified at runtime: with an OS dark preference the app renders
> `<html class="dark">` with a slate-950 background. **Dark mode is already
> live — it just silently follows the OS**, which is why it looks like the
> feature is missing. What is actually absent is any way for a user to override
> that, and any visual sign-off on either appearance.

- [x] `ThemeProvider` wired in the root layout with `attribute="class"`, `defaultTheme="system"`
- [x] `suppressHydrationWarning` on `<html>`
- [x] System preference respected (confirmed: OS dark → `class="dark"`)
- [ ] Remove the hardcoded `className="light"` on `<html>` in `app/layout.tsx` — `next-themes` overrides it at runtime, so it is only the pre-hydration default, but it makes light the flash-of-wrong-theme colour for dark users
- [ ] `ThemeToggle` component (`features/theme-feature/ui/ThemeToggle.tsx`) — light / dark / system, persisted via `next-themes`. Use `mounted` state to avoid rendering the wrong icon before hydration
- [ ] Mount the toggle in the nav bar (`features/ui/Navbar.tsx`)
- [ ] Audit both themes for contrast and legibility across every surface:
  - [ ] Feed grid, article cards, and skeleton placeholders
  - [ ] Source filter pills — selected, unselected, hover, and focus states
  - [ ] Pagination controls, including disabled states
  - [ ] Article detail page, including `dangerouslySetInnerHTML` body content and `prose-invert`
  - [ ] Login card, guest badge, and the upgrade prompt modal
- [ ] Verify scraped article HTML stays readable in dark mode — this is the likeliest
      problem area, since source markup carries its own inline colours that
      `prose-invert` will not touch

**What this gives you:** A user-controllable theme switch, and both appearances
signed off rather than merely written. The wiring is done, so this is a toggle
component plus a visual audit.

---

## Phase 6: Protected + Admin UI [🔴 TODO]

- [ ] **Admin sign-in route** — blocks everything else here. `ADMIN_USER`/`ADMIN_PASS` seed an admin account on boot, but auth is OAuth-only, so there is no way to obtain an ADMIN token through the app; the Phase 4 admin endpoints are only reachable by minting a JWT by hand. Needs a credential login (`POST /api/auth/login`) that verifies `passwordHash` and issues an ADMIN token
- [ ] `/auth/login` page — social login buttons complete (redirects → popup → receive JWT → store in localStorage)
- [ ] Bookmarks page (`protected/bookmarks/page.tsx`) — filtered grid with unsave action, wired to `GET /api/bookmarks` (paginated) and `DELETE /api/bookmarks/:id`
- [ ] Auth state management (`features/auth-feature/lib/authContext.tsx`) — stores token + user role globally
- [ ] `AdminGuard` HOC / route wrapper (per `specs/admin-panel.md:8`) — redirects non-admins to `/auth/login`
- [ ] Admin dashboard (`admin/page.tsx`):
  - [ ] Sources table (name, URL, active status, date added)
  - [ ] Source editor form with CSS selector inputs + validation
  - [ ] "Test Scrape" button → triggers `POST /api/admin/sources/test` → shows preview of scraped title and image
  - [ ] Delete source confirmation UI
- [ ] Admin source form fields for `adapter`, `displayName`, and `articleLimit` (see `GET /api/admin/sources/adapters` for the adapter list and which ones need selectors)
- [ ] Dark mode toggle — tracked in [Phase 5b](#phase-5b-dark--light-mode-toggle--todo)

**What this gives you:** Complete application. Authenticate → browse feed → bookmark articles → manage scraping sources as admin. All specs fully implemented and tested.

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
| 5b (Dark / Light Mode) | ✅ Yes, with Phase 6 | Surfaces to audit exist (Phase 5) |
| 6 (Auth + Admin UI) | No | Phases 4 & 5 complete |

**Critical path:** 1 → 2 → 2b → 3 → 4 → 5 → 6 (5b can land any time after 5)
**Ways to speed up:** Implement phases 2 and 3 in parallel since neither depends on the other. Start frontend pages (phase 5) while phase 4 routes are still being built — mock API responses first, wire to real endpoints later.
