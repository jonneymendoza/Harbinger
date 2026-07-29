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
- [x] `next-themes` config for dark/light mode (per `specs/frontend-ui.md §2.A`)
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

## Phase 4: API Endpoints [🔴 TODO]

### All endpoints (per `specs/api-endpoints.md`)
- [ ] **Public News**
  - [ ] `GET /api/news` — paginated article list with standard response wrapper (limit-offset pagination)
  - [ ] `GET /api/news/:id` — full article with hero image, contentImages[], fullContent
- [ ] **Bookmarks (requires JWT)**
  - [ ] `POST /api/bookmarks` — `{articleId}`
  - [ ] `GET /api/bookmarks` — user's saved articles
  - [ ] `DELETE /api/bookmarks/:id` — remove bookmark
- [ ] **Admin Sources (requires ADMIN role)**
  - [ ] `GET /api/admin/sources`
  - [ ] `POST /api/admin/sources` — add source with CSS selectors
  - [ ] `PUT /api/admin/sources/:id`
  - [ ] `DELETE /api/admin/sources/:id`
  - [ ] `POST /api/admin/sources/test` — live test endpoint that spins up a temporary Playwright instance with the provided selectors

**What this gives you:** Every route in `specs/api-endpoints.md` working, tested with curl. Standard response wrapper (`{success,data,error}`) applied everywhere.

---

## Phase 5: Frontend Public Pages [🔴 TODO]

- [ ] Next.js App Router pages scaffold:
  - [ ] `(public)/page.tsx` — Home/Feed page
  - [ ] `article/[id]/page.tsx` — Article detail view
  - [ ] Layout structure with nav bar (logo, dark mode toggle, login/profile button)
- [ ] Shared UI primitives (`shared/ui/`) — Button, Card, Input per Tailwind theme spec
- [ ] Data fetching:
  - [ ] Server Components for initial page data loads (per `PRD.md §6.B RSC rules`)
  - [ ] SWR hooks (`features/feed-feature/api/useArticles.ts`) for cached navigation
  - [ ] Skeleton loading states (gray pulsing placeholders, per `specs/frontend-ui.md §4.B`)
- [ ] News grid — responsive CSS grid (3–4 cols desktop, 2 tablet, 1 mobile)
- [ ] Article tile component (thumbnail image + title + source + date, hover zoom effect)
- [ ] Article detail page — hero image, rendered HTML content, back-to-feed button

**What this gives you:** Visually browse articles with dark mode. Skeleton loading states per spec. Fully responsive across breakpoints.

---

## Phase 6: Protected + Admin UI [🔴 TODO]

- [ ] `/auth/login` page — social login buttons complete (redirects → popup → receive JWT → store in localStorage)
- [ ] Bookmarks page (`protected/bookmarks/page.tsx`) — filtered grid with unsave action
- [ ] Auth state management (`features/auth-feature/lib/authContext.tsx`) — stores token + user role globally
- [ ] `AdminGuard` HOC / route wrapper (per `specs/admin-panel.md:8`) — redirects non-admins to `/auth/login`
- [ ] Admin dashboard (`admin/page.tsx`):
  - [ ] Sources table (name, URL, active status, date added)
  - [ ] Source editor form with CSS selector inputs + validation
  - [ ] "Test Scrape" button → triggers `POST /api/admin/sources/test` → shows preview of scraped title and image
  - [ ] Delete source confirmation UI
- [ ] Dark mode toggle (`features/theme-feature/ui/ThemeToggle.tsx`) — persists via `next-themes`

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
| 6 (Auth + Admin UI) | No | Phases 4 & 5 complete |

**Critical path:** 1 → 2 → 2b → 3 → 4 → 5 → 6
**Ways to speed up:** Implement phases 2 and 3 in parallel since neither depends on the other. Start frontend pages (phase 5) while phase 4 routes are still being built — mock API responses first, wire to real endpoints later.
