# Product Requirements Document (PRD): News Aggregator System

## 1. Objective
To build a decoupled news aggregation system that scrapes content from specific gaming/community websites and serves it via a REST API to a modern web frontend and future mobile applications.

## 2. Target Sources
The system will support a dynamic list of target sources stored in the database, allowing for runtime additions and modifications without redeploying code. Initial targets include:
*   **Roberts Space Industries:** `https://robertsspaceindustries.com/community-hub/discover`
*   **Arsenal News:** `https://www.arsenal.com/news/all/1`

## 3. System Architecture
The system will follow a **Client-Server-Database** architecture with an asynchronous scraping engine.

### Components:
*   **Backend Server (Node.js/Express):** 
    *   Handles the Scraping Engine.
    *   Exposes a REST API for clients.
    *   Manages User Authentication and Bookmarks.
*   **Database (MongoDB):** Stores cleaned article snapshots and user data.
*   **Web Frontend (Next.js + Tailwind CSS):** Consumes the Backend API; provides a responsive UI with Dark/Light modes.
*   **Future Mobile App:** Will consume the same REST API as the Web Frontend.

## 4. Functional Requirements

### A. Scraping Engine & Data Ownership
*   **Strategy:** Snapshot-based storage. The system will not proxy requests but store cleaned versions of articles in MongoDB.
*   **Dynamic Configuration:** Instead of hardcoded URLs, the scraper fetches a list of "Active Sources" from the database before each execution.
*   **Frequency:** Automatic scrape every 60 minutes using a cron job (`node-cron`).
*   **Extraction Pipeline:** `DB Source List` $\rightarrow$ `Playwright Headless Browser` $\rightarrow$ `Content Cleaning` $\rightarrow$ `JSON Storage`.
*   **Stored Fields:** Hero Image URL, Thumbnail Image URL, Full Article Content (Cleaned), Gallery of Embedded Images [Array], Source Link, Publication Date, and Category.

### B. Administrative Management
*   **Admin UI:** A protected administrative dashboard within the web frontend.
*   **Source Management:** Ability to Add, Edit, or Delete target websites (URLs) and their associated scraping selectors/metadata.
*   **Access Control:** 
    *   Initial setup via Environment Variables (`ADMIN_USER`, `ADMIN_PASS`) used to seed a master admin account upon first boot.
    *   Administrative endpoints secured via a specific `ROLE_ADMIN` claim in the JWT.

### C. User Authentication & Interactivity
*   **Three-Tier Identity Model:**
    1. **Guest (Unauthenticated):** Anonymous users who can browse the public feed and view article details without any login. No personalization available.
    2. **Registered User (Authenticated via OAuth or Guest → Account migration):** Full interactivity including bookmarking, profile persistence, reading history.
    3. **Administrator:** Full access to admin dashboard for source management.
*   **Guest Mode:**
    *   Users may enter the application as a guest with no credentials required.
    *   A temporary anonymous user is created server-side on first entry; a `guest`-scoped JWT is issued (short-lived, 7-day expiry, role `GUEST`).
    *   Guests can browse articles and feeds identically to registered users but **cannot** bookmark. If they try, they are prompted to create an account.
    *   On subsequent visits, the guest session is preserved via the token in localStorage so their experience continues seamlessly.
*   **Authentication Level:** Complex OAuth 2.0 integration (registered users only).
    *   Google Sign-In
    *   Apple ID Sign-In
    *   Facebook Sign-In
*   **Interactivity:** Registered Users can "Bookmark/Save" articles to their profile for later reading.

### D. Web Frontend UI/UX
*   **Home Page:** A modern, responsive grid of tiles (Image + Title).
*   **Article View:** High-fidelity rendering of the cleaned JSON content and images.
*   **Saved Section:** A private area for authenticated users to view their bookmarked articles.
*   **Theming:** Integrated Dark/Light mode toggle.
*   **Responsiveness:** Mobile-first design (compatibility across Desktop, Tablet, and Smartphones).

## 5. Proposed API Schema

### Authentication
`POST /auth/google` | `POST /auth/apple` | `POST /auth/facebook` $\rightarrow$ Returns JWT Token.
`POST /auth/guest` $\rightarrow$ Returns a short-lived guest session token for anonymous browsing.

### News Endpoints
*   `GET /api/news`
    *   **Description:** List all recent articles.
    *   **Params:** `page`, `limit`.
    *   **Response:** Array of `{ id, title, thumbnail, summary, date }`.
*   `GET /api/news/:id`
    *   **Description:** Get full article content.
    *   **Response:** `{ id, title, images[], full_content, source_url, date }`.

### Bookmark Endpoints (Requires JWT)
*   `POST /api/bookmarks`
    *   **Body:** `{ articleId: string }`.
*   `GET /api/bookmarks`
    *   **Response:** Array of bookmarked articles.
*   `DELETE /api/bookmarks/:id`
    *   **Description:** Remove a bookmark.

### Admin Endpoints (Requires ADMIN JWT)
*   `GET /api/admin/sources` $\rightarrow$ List all configured target websites.
*   `POST /api/admin/sources` $\rightarrow$ Add a new target website.
*   `PUT /api/admin/sources/:id` $\rightarrow$ Update source URL or configurations.
*   `DELETE /api/admin/sources/:id` $\rightarrow$ Remove a target website.

## 6. Technical Stack & Architecture

### A. Backend: Clean Architecture (Hexagonal / Ports & Adapters)

The backend follows **Clean Architecture** to separate concerns into concentric layers:

| Layer | Responsibility | Examples in This Project |
|---|---|---|
| **Domains (Entities & Use Cases)** | Core business logic, independent of all frameworks | News service, Auth service, Scraper pipeline use cases |
| **Interfaces (Ports)** | Contracts that adapters must implement | `INewsRepository`, `IBookmarkRepository`, `IScraper`|
| **Infrastructure (Adapters)** | External framework integrations | Mongoose repositories, Playwright scraper, JWT token service, Passport strategies |
| **Presentation** | HTTP layer only — route definitions and request/response mapping | Express controllers and routers |

**Architecture rules:**
- Domains know nothing about infrastructure or presentation layers.
- Interfaces (ports) in `domains/*/interfaces/` are one-directional contracts. Infrastructure implements them; controllers depend only on the interfaces.
- The scraper pipeline is a **use case class**, not a controller — fully testable without MongoDB or Playwright running.
- Each feature (`news`, `bookmarks`, `sources`, `auth`) is a self-contained domain module.

```
backend/src/
├── domains/                     # Feature modules (each has controller, service, interfaces/)
│   ├── news/
│   │   ├── controller.ts
│   │   ├── route.ts
│   │   ├── newsService.ts
│   │   └── interfaces/
│   │       ├── INewsRepository.ts
│   │       └── IScraperStrategy.ts
│   ├── bookmarks/
│   ├── sources/
│   └── auth/
├── infrastructure/              # Adapters implementing ports
│   ├── repositories/            # Mongoose implementations of repository interfaces
│   ├── scraper/                 # Playwright impl, content cleansing, cron scheduler
│   ├── auth/                    # Passport strategies (Google, Apple, Facebook), JWT service
│   └── middleware/              # Auth guard, admin role check
└── shared/
    └── errors/                  # Standardized error classes mapped to HTTP codes
```

### B. Frontend: Feature-Sliced Design (FSD) + React Server Components

The frontend follows **Feature-Sliced Design** vertically sliced by business feature, layered with React Server Components for data fetching:

| Slice | Responsibility | Location in `/src/` |
|---|---|---|
| **app/** | Next.js App Router page routes and layouts | `app/(public)/`, `app/(auth)/login/`, `app/(protected)/bookmarks/`, `app/(admin)/admin/` |
| **features/** | Self-contained vertical slices: UI components, API hooks, server actions, context/state | `features/feed-feature/`, `features/auth-feature/`, `features/bookmark-feature/`, `features/admin-feature/`, `features/theme-feature/` |
| **entities/** | Domain models and their representations | `entities/article/`, `entities/source/` |
| **shared/** | Cross-cutting reusable code: UI primitives, API client, config constants | `shared/ui/`, `shared/api/`, `shared/lib/` |

**Architecture rules:**
- Each `features/*` owns its own UI components, data hooks (`useArticles`, `useBookmarks`), and server actions — complete vertical slice. No horizontal splitting of feature concerns.
- `shared/` contains only dumb, framework primitives (Button, Card) and the API client wrapper — zero business logic.
- React Server Components handle all server-side data fetching in page components. `"use client"` is used **only** where hooks or interactivity is required.
- SWR (`@swr/swr`) for client-side caching of API responses across navigation. `next/image` for automatic image optimization and lazy loading.
- Theme toggled via `next-themes`, dark mode configured with Tailwind's `class` strategy per `specs/frontend-ui.md`.

```
frontend/src/
├── app/                              # Next.js App Router pages & layout groups
│   ├── (public)/page.tsx             # Home / Feed
│   ├── article/[id]/page.tsx         # Article detail (RSC data fetch)
│   └── ...
├── features/                         # Vertical slices (each has ui/, api/, lib/)
│   ├── feed-feature/ui/NewsGrid.tsx
│   ├── auth-feature/api/useAuth.ts
│   ├── bookmark-feature/
│   ├── admin-feature/AdminGuard.tsx
│   └── theme-feature/ThemeToggle.tsx
├── entities/article/                 # Article type + card variants
└── shared/ui/Button.tsx              # Dumb primitives only
```

### C. Technology Stack Reference

| Layer | Technology | Reason |
|---|---|---|
| **Backend Runtime** | Node.js / Express | Rapid development, native JS for Playwright scrapers |
| **Backend Architecture** | Clean Architecture (Ports & Adapters) | Isolate business logic from MongoDB, Playwright, and HTTP. Each feature is independently testable and swappable. |
| **Scraping Engine** | Playwright + node-cron | Headless browser automation for JS-heavy sources; scheduled every 60 minutes |
| **Database** | MongoDB (Mongoose) | Schema-less storage for varying article structures; snapshot-based persistence |
| **Auth** | Passport.js + JWT (HS256) | OAuth 2.0 for Google/Apple/Facebook; stateless token validation on all routes |
| **Frontend Framework** | Next.js App Router | React Server Components, built-in image optimization, SSR for SEO |
| **Frontend Architecture** | Feature-Sliced Design + RSC | Vertical feature slices with reusable primitives; server-side data fetching |
| **Styling** | Tailwind CSS + next-themes | Utility-first styling with dark/light mode support |
| **Data Fetching** | Server actions (RSC) + SWR | Cached client-side navigation, skeleton loading states |
| **Container** | Docker Compose → AWS ECS/EKS | Consistent local/dev/prod environments; migration path to cloud |

## 7. Proposed API Schema
1.  **Phase 1 (Development):** Local environment setup and Scraper validation.
2.  **Phase 2 (Testing):** Deploy Backend, DB, and Frontend via Docker Compose on **TrueNAS**.
3.  **Phase 3 (Cloud Migration):** Transition to AWS (ECS/EKS) or similar infrastructure for production scaling.
