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
    *   **Find RSS feed**: probes the Base URL for RSS/Atom feeds via
        `GET /api/admin/sources/discover-feeds`, checking the page's declared
        `<link rel="alternate">` tags first and then common feed paths. Every
        candidate is fetched and parsed before being offered, so a suggestion is
        never a dead link. Choosing one sets the Base URL to the feed and
        switches the adapter to `rss`.
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

> **Feeds are offered, not chosen.** Discovery deliberately presents what it
> found rather than selecting automatically. Most sites publish several feeds —
> news, reviews, per-article comments — and picking one silently would leave a
> source quietly carrying the wrong content with nothing on screen to explain
> why. Prefer `rss` where a feed exists: it needs no selectors, survives markup
> changes, and works on sites that block scraping of their HTML.

> **Adapter model:** scraping strategy is resolved per source from the `adapter`
> field, so a new source can be added at runtime without a code change. The
> selector-driven `generic` adapter is the default and covers most sites; a site
> that is client-rendered, embeds its content as JSON, or mixes article and
> non-article templates warrants its own adapter (one file plus one registry
> line). Both current sources turned out to need that treatment.

### C. "Live Test" Scraper Tool (Crucial Feature)
To avoid saving a configuration that would silently return nothing on the hourly
job, the editor dry-runs it against a single URL:

1.  The admin enters a candidate configuration — adapter, and CSS selectors where the adapter needs them.
2.  Clicking **"Test Scrape"** sends it to `POST /api/admin/sources/test`.
3.  The backend loads the page once, records what it saw, then attempts the extraction.
4.  **On success:** a preview of the title, hero image, summary and content length.
5.  **On failure:** a plain-language reason, plus a **"View details — what the scraper saw"** panel, expanded automatically since that is the moment it is needed.

The details cover page title, rendered and visible size, paragraph count,
`og:` tag presence, per-selector match counts, and whether the site served a
bot-check or refused the request outright.

> **A failure has to say why.** Reporting only that a scrape failed leaves the
> admin guessing between a wrong selector, a listing page tested in place of an
> article, and a site that refuses automated access — three problems with
> nothing in common. The reason is chosen most-specific first, so a site block is
> reported ahead of anything about selectors: no selector can match a page that
> was never served.

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
| Finding a feed | `GET /api/admin/sources/discover-feeds?url=` | Suggests RSS/Atom feeds for a site |
| Saving New Source | `POST /api/admin/sources` | `specs/api-endpoints.md` |
| Updating Source | `PUT /api/admin/sources/:id` | `specs/api-endpoints.md` |
| Toggling Active State | `PATCH /api/admin/sources/:id/toggle` | `specs/api-endpoints.md` |
| Testing Configuration | `POST /api/admin/sources/test` | *New endpoint for validation* |
| Removing Source | `DELETE /api/admin/sources/:id` | `specs/api-endpoints.md` |
| Manual Scrape Trigger | `POST /api/admin/sources/run-scraper` | Runs every active source on demand |
| Single-Source Scrape | `POST /api/admin/sources/:id/scrape` | Scrapes one source; used by "Scrape now" and run automatically after a source is added |

### 5.1 Scrape feedback

A full run takes minutes, nearly all of it on sources with nothing new. Two
things follow from that:

*   **A newly added source is scraped immediately**, so the feed reflects it
    without waiting for the hourly cron. Adding a source and finding the feed
    unchanged reads as the source having failed.
*   **Completion toasts report counts, not just completion.** "Scrape finished"
    alone was shown whether or not anything had been added. The toast now states
    articles added, links checked, and names any source that had a problem —
    including a source that discovered **zero links**, which raises no error of
    its own but is how a broken adapter presents.

Scrapes share a single lock. A request made while one is running returns **409
CONFLICT**, which the UI reports as "wait for the current run" rather than an
error.

## 6. Future Extensibility
*   **Scrape Logs:** Ability to view the logs of the hourly cron job to identify which sites are failing and why.
*   **User Management:** A screen to promote existing users to Admin status or revoke access.
