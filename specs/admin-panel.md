# Feature Specification: Administrative Management Panel

## 1. Overview
The Admin Panel is a restricted section of the Web Frontend designed for system operators to manage the news aggregation pipeline without writing code or modifying database entries manually.

## 2. Access Control & Security
*   **Permission:** Only users with the `role: "ADMIN"` claim in their JWT can access these routes.
*   **Route Protection:** All admin pages are wrapped in a Higher Order Component (HOC) that redirects unauthenticated or non-admin users to the login page or a 403 Forbidden page.
*   **API Guard:** Every request sent by this panel is validated by the `checkRole("ADMIN")` middleware on the backend.

## 3. Core Functional Features

### A. Source Management Dashboard
A centralized table displaying all configured target websites:
*   **Columns:** Site Name, Base URL, Status (Active/Inactive), Date Added.
*   **Actions:** Edit configuration, Toggle Active state, Delete source.

### B. Source Configuration Editor
A form to add or modify scraping targets.
*   **Inputs:**
    *   `Name`: Internal identifier for the source.
    *   `Display Name`: Short label shown on the public feed filter. Defaults to `Name`.
    *   `Base URL`: The starting point for scraping.
    *   `Adapter`: Which scraping strategy handles this source. Populated from
        `GET /api/admin/sources/adapters`, which returns each adapter's `key`,
        `label`, `description` and a `requiresSelectors` flag.
    *   `Article Limit`: Newest articles considered per run, overriding the global
        `SCRAPER_ARTICLE_LIMIT`. Optional. Needed for sources whose listings mix
        articles with other page types — RSI Comm-Link is ~45% articles, so it
        needs a higher ceiling to yield the same article count as Arsenal.
    *   `CSS Selectors`: `Article Link`, `Page Title`, `Main Content Body`, and
        `Hero Image`. **Shown only when the selected adapter reports
        `requiresSelectors: true`.** Site-specific adapters (`arsenal`,
        `rsi-commlink`) know their own page structure and take no selectors;
        demanding them would ask the operator for values that do nothing.
*   **Validation:** Real-time validation that URLs are well-formed `http(s)`, that
    the article limit is an integer in 1–200, and that the selector fields are
    present when — and only when — the chosen adapter needs them.

> **Adapter model:** scraping strategy is resolved per source from the `adapter`
> field, so a new source can be added at runtime without a code change. The
> selector-driven `generic` adapter is the default and covers most sites; a site
> that is client-rendered, embeds its content as JSON, or mixes article and
> non-article templates warrants its own adapter (one file plus one registry
> line). Both current sources turned out to need that treatment.

### C. "Live Test" Scraper Tool (Crucial Feature)
To avoid saving broken selectors that would crash the hourly cron job, the Admin Panel will include a **Test Connection** feature:
1.  The admin enters proposed CSS selectors in the editor.
2.  Clicking **"Test Scrape"** sends these selectors to a special backend endpoint (`POST /api/admin/sources/test`).
3.  The Backend spins up a temporary Playwright instance, attempts to scrape *one* article using those la-hoc selectors, and returns the result.
4.  **Frontend Result:** The admin sees a preview of the scraped title and image. If it's empty or wrong, the admin adjusts the selectors before clicking "Save."

## 4. UI/UX Design Guidelines
*   **Layout:** A simple sidebar navigation (Dashboard $\rightarrow$ Sources $\rightarrow$ System Logs).
*   **Feedback Loops:** Use toast notifications for success/failure of API calls (e.g., "Source updated successfully").
*   **Consistency:** Inherits the same Light/Dark mode settings as the public frontend for visual harmony.

## 5. Integration Map
| Admin Action | Backend Endpoint | Specification Reference |
| :--- | :--- | :--- |
| Admin sign-in | `POST /api/auth/login` | Credential login; OAuth cannot reach the seeded admin |
| Loading Source List | `GET /api/admin/sources` | `specs/api-endpoints.md` |
| Loading Adapter List | `GET /api/admin/sources/adapters` | Drives the adapter picker and selector visibility |
| Saving New Source | `POST /api/admin/sources` | `specs/api-endpoints.md` |
| Updating Source | `PUT /api/admin/sources/:id` | `specs/api-endpoints.md` |
| Toggling Active State | `PATCH /api/admin/sources/:id/toggle` | `specs/api-endpoints.md` |
| Testing Configuration | `POST /api/admin/sources/test` | *New endpoint for validation* |
| Removing Source | `DELETE /api/admin/sources/:id` | `specs/api-endpoints.md` |
| Manual Scrape Trigger | `POST /api/admin/sources/run-scraper` | Runs the pipeline on demand |

## 6. Future Extensibility
*   **Scrape Logs:** Ability to view the logs of the hourly cron job to identify which sites are failing and why.
*   **User Management:** A screen to promote existing users to Admin status or revoke access.
