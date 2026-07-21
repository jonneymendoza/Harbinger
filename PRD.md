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
*   **Authentication Level:** Complex OAuth 2.0 integration.
    *   Google Sign-In
    *   Apple ID Sign-In
    *   Facebook Sign-In
*   **Interactivity:** Users can "Bookmark/Save" articles to their profile for later reading.

### C. Web Frontend UI/UX
*   **Home Page:** A modern, responsive grid of tiles (Image + Title).
*   **Article View:** High-fidelity rendering of the cleaned JSON content and images.
*   **Saved Section:** A private area for authenticated users to view their bookmarked articles.
*   **Theming:** Integrated Dark/Light mode toggle.
*   **Responsiveness:** Mobile-first design (compatibility across Desktop, Tablet, and Smartphones).

## 5. Proposed API Schema

### Authentication
`POST /auth/google` | `POST /auth/apple` | `POST /auth/facebook` $\rightarrow$ Returns JWT Token.

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

## 6. Technical Stack
| Layer | Technology | Reason |
| :--- | :--- | :--- |
| **Backend** | Node.js / Express | Rapid development, native JS support for scrapers. |
| **Scraping** | Playwright | Handles Dynamic/JS-heavy content of target sites. |
| **Database** | MongoDB | Schema-less flexibility for varying article structures. |
| **Frontend** | Next.js / Tailwind | SSR for SEO, fast performance, and easy Dark Mode. |
| **Auth** | Passport.js / OAuth 2.0 | Standardized implementation of Social logins. |
| **Container** | Docker / Docker Compose | Ease of deployment on TrueNAS $\rightarrow$ AWS. |

## 7. Deployment Roadmap
1.  **Phase 1 (Development):** Local environment setup and Scraper validation.
2.  **Phase 2 (Testing):** Deploy Backend, DB, and Frontend via Docker Compose on **TrueNAS**.
3.  **Phase 3 (Cloud Migration):** Transition to AWS (ECS/EKS) or similar infrastructure for production scaling.
