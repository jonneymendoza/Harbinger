# Agents Guide - News Aggregator

## System Architecture
Decoupled Client-Server-Database architecture:
- **Backend:** Node.js/Express + Playwright (Scraper)
- **Frontend:** Next.js + Tailwind CSS
- **Database:** MongoDB (Stored snapshots of articles & User data)
- **Deployment:** Docker Compose (TrueNAS $\rightarrow$ AWS migration path)

## Critical Context & Constraints
- **Sources of Truth:** Always refer to `PRD.md` and the files in `/specs/` before implementing new features or modifying existing ones.
- **Data Ownership:** The system uses a **Snapshot approach**. Articles are scraped, cleaned, and stored in MongoDB; they are NEVER proxied from source sites in real-time.
- **Dynamic Scraping:** Target URLs and CSS selectors must be retrieved from the `sources` collection in MongoDB, not hardcoded.
- **Admin Bootstrap:** The initial administrator account is created on first boot using `ADMIN_USER` and `ADMIN_PASS` environment variables.

## Technical Gotchas
- **Playwright Dependencies:** When modifying Dockerfiles, ensure Playwright system dependencies (browsers/OS libraries) are preserved; otherwise, the scraper will fail in headless mode.
- **Auth Flow:** Authentication uses OAuth 2.0 for social logins and JWTs for session management. Admin routes require a `ROLE_ADMIN` claim in the JWT.
- **CORS:** Ensure API origins are strictly managed to allow only the frontend and future mobile app access.

## API Contract
- **Swagger Docs:** All API endpoints are documented in `/backend/SWAGGER.md` (machine-readable OpenAPI YAML included).
- **Rule:** Any time a backend route is amended, added, or removed, SWAGGER.md must be updated to match before the change is considered complete.

## Project Structure Reference
- `/PRD.md`: High-level requirements.
- `/specs/`: Detailed feature specifications (the "How" guide).
