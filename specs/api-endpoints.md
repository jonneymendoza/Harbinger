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
      "baseUrl": "URL",
      "articleLinkSelector": "CSS Selector",
      "contentSelector": "CSS Selector",
      "titleSelector": "CSS Selector",
      "imageSelector": "CSS Selector",
      "isActive": boolean
    }
    ```

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
