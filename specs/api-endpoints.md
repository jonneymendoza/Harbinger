# Feature Specification: API Endpoints Contract

## 1. Overview
This document defines the "contract" between the Backend Server and all clients (Web Frontend and Mobile App). All endpoints follow RESTful principles and communicate using JSON.

## 2. General Specifications
*   **Base URL:** `/api`
*   **Content-Type:** `application/json`
*   **Pagination Strategy:** Limit-Offset pagination used for lists to ensure performance as the database grows.
*   **Standard Response Wrapper:**
    ```json
    {
      "success": boolean,
      "data": any | null,
      "error": { "message": string, "code": string } | null
    }
    ```

## 3. News Endpoints (Public)

### `GET /api/news`
*   **Description:** Fetch a paginated list of recent news articles across all active sources.
*   **Query Params:** 
    *   `page` (int, default: 1)
    *   `limit` (int, default: 20)
*   **Response Data:**
    ```json
    {
      "articles": [
        {
          "id": "ObjectId",
          "title": "String",
          "thumbnailImage": "URL",
          "summary": "String",
          "publishedAt": "ISO-Date",
          "sourceName": "String"
        }
      ],
      "totalArticles": 150,
      "currentPage": 1,
      "totalPages": 8
    }
    ```

### `GET /api/news/:id`
*   **Description:** Retrieve the full content of a specific article.
*   **Response Data:**
    ```json
    {
      "id": "ObjectId",
      "title": "String",
      "heroImage": "URL",
      "thumbnailImage": "URL",
      "contentImages": ["URL"],
      "fullContent": "Cleaned HTML/Markdown",
      "sourceUrl": "URL",
      "category": "String",
      "publishedAt": "ISO-Date",
      "scrapedAt": "ISO-Date"
    }
    ```

## 4. Bookmark Endpoints (Authenticated - USER/ADMIN)
*Requires: Valid JWT in Authorization Header (`Bearer <token>`)*

### `GET /api/bookmarks`
*   **Description:** Fetch all articles bookmarked by the authenticated user.
*   **Response Data:** Same as `GET /api/news` but filtered to users' bookmarks.

### `POST /api/bookmarks`
*   **Description:** Add an article to the user's bookmark list.
*   **Request Body:** `{ "articleId": "ObjectId" }`
*   **Response:** `{ "success": true, "message": "Article saved." }`

### `DELETE /api/bookmarks/:id`
*   **Description:** Remove a specific article from bookmarks.
*   **Response:** `{ "success": true, "message": "Article removed." }`

## 5. Admin Endpoints (Authenticated - ADMIN Only)
*Requires: Valid JWT with `role: "ADMIN"` claim*

### `GET /api/admin/sources`
*   **Description:** List all scraping targets configured in the DB.
*   **Response Data:** Array of Source objects as defined in `specs/backend-scrapper.md`.

### `POST /api/admin/sources`
*   **Description:** Add a new target website for the scraper to track.
*   **Request Body:** 
    ```json
    {
      "name": "String",
      "displayName": "String (optional, defaults to name)",
      "baseUrl": "URL — listing page, or the feed itself for the rss adapter",
      "adapter": "String — rss | generic | arsenal | rsi-commlink (default: generic)",
      "articleLimit": "Number (optional, 1-200)",
      "articleLinkSelector": "CSS Selector — required for the generic adapter only",
      "contentSelector": "CSS Selector — required for the generic adapter only",
      "titleSelector": "CSS Selector",
      "imageSelector": "CSS Selector",
      "isActive": boolean
    }
    ```
*   **Validation:** Selector fields are required only when the chosen adapter reports `requiresSelectors`. Site-specific and feed adapters know their own structure and take none.

### `GET /api/admin/sources/discover-feeds?url=`
*   **Description:** Probes a site for RSS/Atom feeds so the operator can pick one instead of hunting for the path.
*   **Behaviour:** Checks the page's declared `<link rel="alternate">` tags first, then a list of common feed paths. Every candidate is fetched and parsed before being reported, so a path returning 200 HTML for a missing feed is rejected. The path fallback runs even when the page itself is refused, so a blocked site's feed is still found.
*   **Response Data:**
    ```json
    {
      "feeds": [
        { "url": "URL", "title": "String", "itemCount": 113, "source": "declared | common-path | provided" }
      ],
      "recommendedAdapter": "rss | generic"
    }
    ```
*   **Note:** Reports candidates only. Selection is left to the operator — most sites publish several feeds, and choosing silently would leave a source carrying the wrong content with no visible explanation.

### `POST /api/admin/sources/test`
*   **Description:** Dry-runs a candidate configuration against one URL, reporting whether an article could be extracted and, when it could not, **why**.
*   **Request Body:** `{ url, adapter, baseUrl?, name?, articleLinkSelector?, contentSelector?, titleSelector?, imageSelector? }`
*   **Response Data:**
    ```json
    {
      "ok": false,
      "reason": "Plain-language cause, or null when ok",
      "diagnostics": {
        "pageTitle": "String | null",
        "renderedChars": 3356,
        "visibleTextChars": 204,
        "botChallengeDetected": false,
        "accessBlocked": true,
        "hasOgTitle": false,
        "hasOgImage": false,
        "paragraphCount": 1,
        "selectorMatches": { "articleLink": null, "content": 0, "title": null, "image": null },
        "fetchError": "String | null"
      },
      "article": null
    }
    ```
*   **Reason ordering:** most-specific first, so the operator gets the actionable cause rather than a downstream symptom — load failure, then a site refusing the request, then a bot-check interstitial, then a missing selector, then a selector that matched nothing, then a page with no paragraphs. A site block is reported ahead of anything about selectors, because no selector can match a page that was never served.
*   **Note:** Returns `200` with `ok: false` for a configuration that does not work; the request itself succeeded. `4xx` is reserved for a malformed request. Diagnostics are returned on success too.

### `PUT /api/admin/sources/:id`
*   **Description:** Update existing source configuration.
*   **Request Body:** Same as POST (Partial updates allowed).

### `DELETE /api/admin/sources/:id`
*   **Description:** Remove a source target from the system.
*   **Response:** `{ "success": true, "message": "Source removed." }`

## 6. Error Code Map
| HTTP Code | Internal Error Code | Meaning |
| :--- | :--- | :--- |
| `400` | `BAD_REQUEST` | Invalid input parameters or malformed JSON. |
| `401` | `UNAUTHORIZED` | Token missing, expired, or invalid. |
| `403` | `FORBIDDEN` | Authenticated but lacks Admin privileges. |
| `404` | `NOT_FOUND` | Article or Source ID does not exist. |
| `500` | `SERVER_ERROR` | Database connection failure or internal crash. |
