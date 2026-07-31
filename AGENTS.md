# Agents Guide - News Aggregator

## System Architecture
Decoupled Client-Server-Database architecture:
- **Backend:** Node.js/Express + source adapters (Playwright used only where a site needs it)
- **Frontend:** Next.js + Tailwind CSS
- **Database:** MongoDB (Stored snapshots of articles & User data)
- **Deployment:** Docker Compose (TrueNAS $\rightarrow$ AWS migration path)

## Critical Context & Constraints
- **Sources of Truth:** Always refer to `PRD.md` and the files in `/specs/` before implementing new features or modifying existing ones.
- **Data Ownership:** The system uses a **Snapshot approach**. Articles are scraped, cleaned, and stored in MongoDB; they are NEVER proxied from source sites in real-time.
- **Dynamic Scraping:** Every source is configured in the `sources` collection — never hardcoded. Each names the `adapter` that handles it, resolved at runtime, so a source can be added through the admin UI without a code change.
- **Admin Bootstrap:** The initial administrator account is created on first boot using `ADMIN_USER` and `ADMIN_PASS` environment variables. OAuth cannot reach that account — `POST /api/auth/login` is the credential route.

## Scraping: the adapter model
Adapters implement `ISourceAdapter` (`discoverLinks` + `parseArticle`) and receive an
`AdapterContext` offering `fetchHtml` (plain HTTP) and `renderHtml` (headless).
**Adapters never touch Playwright directly** — that keeps each testable against a
stubbed context and means Chromium launches only when something asks to render.

| Adapter | Discovery | Article body | Selectors |
| :--- | :--- | :--- | :--- |
| `rss` | Feed items | The feed itself; the page is never fetched | None |
| `sitemap` | `sitemap.xml` | The page, plain HTTP first then render | Optional |
| `generic` | `articleLinkSelector` | `contentSelector` | Required |
| `arsenal` | Published articles sitemap | `__NEXT_DATA__` payload | None |
| `rsi-commlink` | Server-rendered listing cards | `.g-article__body` after render | None |

**Prefer whatever the site publishes deliberately.** Order: feed → sitemap →
selectors. `GET /api/admin/sources/discover-feeds?url=` reports what a site
offers; selectors are the fallback, not the default.

> **Investigating a broken or new source?** Read
> `skills/backend/diagnose-scraping-source/SKILL.md` first. It carries the
> procedure and the case notes for the three sources already fixed — the failure
> modes repeat, and it will save you rediscovering them.

## Technical Gotchas
- **Playwright Dependencies:** When modifying Dockerfiles, ensure Playwright system dependencies (browsers/OS libraries) are preserved; otherwise, rendering fails in headless mode.
- **Auth Flow:** OAuth 2.0 for social logins, JWT for sessions. `authMiddleware` verifies the signature only; role checks belong in `checkRole`. Admin routes require `ROLE_ADMIN`.
- **CORS:** Ensure API origins are strictly managed to allow only the frontend and future mobile app access.
- **Plain fetch and headless render are not interchangeable.** Sites treat them differently — Arsenal serves plain HTTP but answers headless Chrome with "Access Denied"; TechPowerUp refuses both while serving its RSS feed happily. Always verify from inside the container: your own browser has a different IP and fingerprint and will give different answers.
- **Zero links discovered is a failure, not a quiet success.** It is how a silently broken adapter presents, so the scrape log records it as degraded despite no error being raised.
- **Frontend API client:** `parseResponse` unwraps the `{success,data,error}` envelope once, centrally. Callers get the payload directly — do not reach for `res.data.data`.
- **Rebuild the container you changed.** Editing backend code and rebuilding only `frontend-app` is an easy way to debug a fix that was never deployed.

## API Contract
- **Swagger Docs:** All API endpoints are documented in `/backend/SWAGGER.md` (machine-readable OpenAPI YAML included).
- **Rule:** Any time a backend route is amended, added, or removed, SWAGGER.md must be updated to match before the change is considered complete.
- **Response wrapper:** every response, success or failure, is `{ success, data, error }`. Error codes follow `specs/api-endpoints.md §6` — 401 for a missing or invalid token, 403 for authenticated-but-unprivileged.

## Testing
- `cd backend && npx vitest run` — unit and route tests, no network.
- `SCRAPER_LIVE_TESTS=1 npx vitest run tests/adapters.live.test.ts` — opt-in live checks against real sites; the fastest way to notice a site changed its markup.
- Route contracts are tested with `supertest` against an injected repository, so no Mongo is needed.

## Project Structure Reference
- `/PRD.md`: High-level requirements.
- `/specs/`: Detailed feature specifications (the "How" guide).
- `/PHASES.md`: Implementation checklist and current status.
- `/skills/`: Task-specific procedures for agents.
