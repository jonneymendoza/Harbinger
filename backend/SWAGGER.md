# Harbinger Backend API — OpenAPI 3.0 Specification

> **Base URL:** `http://localhost:8082/api` (Docker) / Development: `http://localhost:5000/api`
>
> **Browsable docs:** <http://localhost:8082/api/docs> — Swagger UI, served from
> the YAML block in this file. Set `SWAGGER_UI=false` to disable it.

The **OpenAPI YAML block below is the source of truth** and covers every route.
The prose sections above it are worked examples for the most-used endpoints; if
the two ever disagree, the YAML is right and the prose is stale.

---

## Table of Contents

- [Authentication](#authentication)
- [Health Check](#health-check)
- [Auth — OAuth Flows](#auth--oauth-flows)
- [Auth — Logout](#auth--logout)
- [Bookmarks](#bookmarks--user-article-collection)
- [Response Schema](#response-schema)
- [Error Codes](#error-codes)
- [OpenAPI YAML](#openapi-yaml-machine-readable)

---

## Authentication

The API uses **Bearer JWT** tokens for protected routes. Acquire a token via the OAuth flow below, then include it in requests:

```
Authorization: Bearer <jwt_token>
```

Tokens expire per `JWT_EXPIRY` (default `30d`).

---

## Health Check

### Get System Health

```http
GET /api/health
```

#### Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-07-22T15:28:26.733Z",
    "database": "connected"
  },
  "error": null
}
```

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | Always `true` on success |
| `data.status` | `string` | `"ok"` |
| `data.timestamp` | `string` | ISO-8601 timestamp |
| `data.database` | `string` | MongoDB connection state (`connected`, `connecting`, `disconnecting`, `disconnected`) |
| `error` | `null` | Present but null on success |

**Error Response — `500 Internal Server Error`:**

```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "Health check failed",
    "code": "HEALTH_CHECK_FAILED"
  }
}
```

---

## Auth — OAuth Flows

### Initiate OAuth Flow

> **Purpose:** Get the provider's auth URL to redirect the user.
> Returns an HTTP 200 with `authorizationUrl` in the body — the frontend redirects to this URL.

```http
POST /api/auth/:provider
```

#### Path Parameters

| Parameter | Type | Allowed Values | Description |
|---|---|---|---|
| `provider` | `string` | `"google"`, `"apple"`, `"facebook"` | OAuth provider |

#### Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://accounts.google.com/..."
  },
  "error": null
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `INVALID_PROVIDER` | Provider not in allowed list |
| `500` | `OAUTH_INIT_ERROR` | Passport middleware error |
| `500` | `NO_AUTH_URL` | Authorization URL unavailable from provider |

#### Error Body Examples

**Invalid provider:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "Provider 'twitter' is not supported",
    "code": "INVALID_PROVIDER"
  }
}
```

---

### OAuth Callback Endpoints

Each provider has its own callback URL. These are called automatically by the OAuth provider after the user authorizes the app.

| Endpoint | Method | Auth Required | Description |
|---|---|---|---|
| `/api/auth/google/callback` | `GET` | No | Google OAuth 2.0 callback |
| `/api/auth/apple/callback` | `GET` | No | Apple Sign-In callback |
| `/api/auth/facebook/callback` | `GET` | No | Facebook OAuth 2.0 callback |

#### Response — `200 OK` (successful login)

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  },
  "error": null
}
```

| Field | Type | Description |
|---|---|---|
| `data.token` | `string` | JWT bearer token (includes `sub`, `email`, `role`) |

#### Error Response — `401 Unauthorized`

```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "Authentication failed",
    "code": "AUTH_FAILED"
  }
}
```

---

## Auth — Logout

### Invalidate Current Session (Optional)

> **Note:** Currently returns a generic success. JWTs are unforgeable by design; this route may be extended for token revocation or server-side session cleanup in the future.

```http
POST /api/auth/logout
```

#### Headers

| Header | Required | Value |
|---|---|---|
| `Authorization` | Yes | `Bearer <jwt_token>` |

#### Response — `200 OK`

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `401` | `UNAUTHORIZED` | Missing or invalid Bearer token |

---

## Bookmarks — User Article Collection

Every bookmark route requires a token with role `USER` or `ADMIN`. A guest token
authenticates successfully but is rejected with `403 FORBIDDEN` — guests can read
the feed but cannot save to it.

### `GET /api/bookmarks`
The user's bookmarked articles, paginated. Same response shape as `GET /api/news`.

Query: `page` (default 1), `limit` (default 20, clamped to 100).

```json
{
  "success": true,
  "data": {
    "articles": [
      {
        "id": "67a1b2c3d4e5f6a7b8c9d0e1",
        "title": "Arsenal Win Over Chelsea",
        "summary": "A dramatic match...",
        "thumbnailImage": "https://example.com/img.jpg",
        "publishedAt": "2026-06-23T14:30:00Z",
        "sourceName": "Arsenal"
      }
    ],
    "totalArticles": 4,
    "currentPage": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "error": null
}
```

---

### `GET /api/bookmarks/ids`
Just the bookmarked article ids, so the feed can mark cards as saved without
fetching every article. Declared before `/:id` so that route does not capture
`"ids"`.

```json
{ "success": true, "data": { "ids": ["67a1b2c3d4e5f6a7b8c9d0e1"] }, "error": null }
```

---

### `POST /api/bookmarks`
Add an article. The id goes in the **body**, not the path.

```json
{ "articleId": "67a1b2c3d4e5f6a7b8c9d0e1" }
```

Idempotent: bookmarking twice is a success, not a conflict.

#### Response — `201 Created`
```json
{
  "success": true,
  "data": { "articleId": "67a1b2c3d4e5f6a7b8c9d0e1", "bookmarked": true, "alreadyBookmarked": false },
  "error": null
}
```

| Status | Code | Description |
|---|---|---|
| `400` | `BAD_REQUEST` | `articleId` missing or malformed |
| `401` | `UNAUTHORIZED` | Token missing or invalid |
| `403` | `FORBIDDEN` | Guest session |
| `404` | `NOT_FOUND` | Article does not exist |

---

### `DELETE /api/bookmarks/:id`
Remove one bookmark. `:id` is the **article** id.

```json
{ "success": true, "data": { "articleId": "67a1b2c3d4e5f6a7b8c9d0e1", "bookmarked": false }, "error": null }
```

| Status | Code | Description |
|---|---|---|
| `400` | `BAD_REQUEST` | Malformed article ID |
| `404` | `NOT_FOUND` | The user had no such bookmark |

---

### `DELETE /api/bookmarks` (bulk)
Clear **all** bookmarks for the authenticated user.

```json
{ "success": true, "data": { "cleared": true }, "error": null }
```

---

## Response Schema

All endpoints follow a unified response envelope:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

- `success` (`boolean`) — `true` on success, `false` on error.
- `data` (any) — Response payload; `null` if not applicable.
- `error` (object \| null) — Present when `success` is `false`. Has `message` and `code` fields.

---

## Error Codes

| Code | HTTP Status | Source / Context |
|---|---|---|
| `INVALID_PROVIDER` | 400 | Initiate OAuth with bad provider |
| `OAUTH_INIT_ERROR` | 500 | Passport authorize middleware error |
| `NO_AUTH_URL` | 500 | Auth URL not available from provider |
| `OAUTH_CALLBACK_ERROR` | 500 | Callback passport.authenticate error |
| `AUTH_FAILED` | 401 | Provider callback rejected the authentication |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token |
| `FORBIDDEN` | 403 | Insufficient role/permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `HEALTH_CHECK_FAILED` | 500 | MongoDB connection failure during health check |

---

## OpenAPI YAML (Machine-Readable)

```yaml
openapi: "3.0.3"
info:
  title: Harbinger News Aggregator API
  version: "0.2.0"
  description: >
    Backend API for the Harbinger news aggregator: authentication, the public
    news feed, bookmarks, and the admin source/scraper console.

    Every response — success or failure — uses the envelope
    `{ success, data, error }`. Error codes follow `specs/api-endpoints.md §6`.
servers:
  - url: http://localhost:8082/api
    description: Docker Compose
  - url: http://localhost:5000/api
    description: Local development
tags:
  - name: System
    description: Health and readiness
  - name: Auth
    description: OAuth, credential login, guest sessions
  - name: News
    description: The public article feed
  - name: Bookmarks
    description: Per-user saved articles
  - name: Admin
    description: Source configuration and scraper control (ADMIN role)

paths:
  # ══ System ═══════════════════════════════════════════════════
  /health:
    get:
      tags: [System]
      summary: Health check
      operationId: getHealth
      responses:
        "200":
          description: System is healthy
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/HealthResponse"
        "500":
          description: Health check failed (e.g. MongoDB down)
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  # ══ Auth ═════════════════════════════════════════════════════
  /auth/{provider}:
    post:
      tags: [Auth]
      summary: Begin an OAuth flow
      description: >
        Returns the provider's authorization URL. The frontend opens a popup and
        navigates it there. Does not redirect on the server.
      operationId: initOAuth
      parameters:
        - name: provider
          in: path
          required: true
          schema:
            type: string
            enum: [google, apple, facebook]
      responses:
        "200":
          description: Authorization URL issued
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/OAuthInitResponse"
        "400":
          description: Unsupported provider (INVALID_PROVIDER)
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "500":
          description: Provider not configured (NOT_CONFIGURED)
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /auth/google/callback:
    get:
      tags: [Auth]
      summary: Google OAuth redirect target
      operationId: googleCallback
      parameters:
        - name: code
          in: query
          required: true
          schema: { type: string }
      responses:
        "302":
          description: Redirects back to the frontend carrying the JWT

  /auth/apple/callback:
    get:
      tags: [Auth]
      summary: Apple Sign-In redirect target
      operationId: appleCallback
      parameters:
        - name: code
          in: query
          required: true
          schema: { type: string }
      responses:
        "302":
          description: Redirects back to the frontend carrying the JWT

  /auth/facebook/callback:
    get:
      tags: [Auth]
      summary: Facebook OAuth redirect target
      operationId: facebookCallback
      parameters:
        - name: code
          in: query
          required: true
          schema: { type: string }
      responses:
        "302":
          description: Redirects back to the frontend carrying the JWT

  /auth/login:
    post:
      tags: [Auth]
      summary: Credential login
      description: >
        Scoped to `provider: 'local'`. This is the only route that can reach the
        seeded admin account, which has no OAuth identity. Rate limited.

        An unknown email and a wrong password return the same 401 — telling them
        apart would confirm which addresses exist.
      operationId: login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email: { type: string, format: email }
                password: { type: string, format: password }
      responses:
        "200":
          description: Token and user profile
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LoginResponse"
        "400":
          description: Email or password missing
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "401":
          description: Invalid email or password
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "429":
          description: Too many attempts
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /auth/guest:
    post:
      tags: [Auth]
      summary: Issue a guest session token
      description: >
        Lets a visitor browse the feed without an account. Guests can read but
        cannot bookmark — the bookmark routes require USER or ADMIN.
      operationId: guestSession
      responses:
        "200":
          description: Guest JWT issued
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LoginResponse"

  /auth/logout:
    post:
      tags: [Auth]
      summary: Log out
      operationId: logout
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Session ended
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SuccessEnvelope"
        "401":
          description: Token missing or invalid
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  # ══ News ═════════════════════════════════════════════════════
  /news:
    get:
      tags: [News]
      summary: Paginated article feed
      description: >
        Public. Sorted newest first across every source, so a newly added source
        appears wherever its article dates place it — not necessarily page 1.
      operationId: listNews
      parameters:
        - name: page
          in: query
          schema: { type: integer, minimum: 1, default: 1 }
        - name: limit
          in: query
          description: Clamped to 100; an unbounded limit could read the whole collection.
          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
        - name: source
          in: query
          description: Source id. An unrecognised value is rejected rather than silently ignored.
          schema: { type: string, format: mongo-object-id }
      responses:
        "200":
          description: A page of articles
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/ArticlePage"
        "400":
          description: Malformed source filter
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /news/sources:
    get:
      tags: [News]
      summary: Sources that currently have articles
      description: >
        Drives the feed's filter pills. Public, because the feed is.

        A source with nothing scraped yet is omitted — it would be a filter that
        returns an empty feed.
      operationId: listFeedSources
      responses:
        "200":
          description: Filter list with counts
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          sources:
                            type: array
                            items:
                              $ref: "#/components/schemas/FeedSource"
                          totalArticles: { type: integer, example: 117 }

  /news/{id}:
    get:
      tags: [News]
      summary: Full article content
      operationId: getArticle
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: mongo-object-id }
      responses:
        "200":
          description: The article
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/ArticleDetail"
        "400":
          description: Malformed article ID
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "404":
          description: Article not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  # ══ Bookmarks ════════════════════════════════════════════════
  /bookmarks:
    get:
      tags: [Bookmarks]
      summary: The user's bookmarked articles, paginated
      operationId: listBookmarks
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema: { type: integer, minimum: 1, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
      responses:
        "200":
          description: A page of bookmarked articles, same shape as GET /news
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/ArticlePage"
        "401":
          description: Token missing or invalid
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "403":
          description: Authenticated as a guest, which cannot hold bookmarks
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
    post:
      tags: [Bookmarks]
      summary: Bookmark an article
      description: >
        Idempotent — bookmarking twice succeeds and reports `alreadyBookmarked`,
        rather than returning a conflict.
      operationId: addBookmark
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [articleId]
              properties:
                articleId: { type: string, format: mongo-object-id }
      responses:
        "201":
          description: Bookmark stored
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          articleId: { type: string }
                          bookmarked: { type: boolean, example: true }
                          alreadyBookmarked: { type: boolean, example: false }
        "400":
          description: articleId missing or malformed
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "401":
          description: Token missing or invalid
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "403":
          description: Guest session
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "404":
          description: Article does not exist
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
    delete:
      tags: [Bookmarks]
      summary: Clear every bookmark for the user
      operationId: clearBookmarks
      security:
        - bearerAuth: []
      responses:
        "200":
          description: All bookmarks removed
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          cleared: { type: boolean, example: true }
        "401":
          description: Token missing or invalid
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /bookmarks/ids:
    get:
      tags: [Bookmarks]
      summary: Just the bookmarked article ids
      description: >
        Lets the feed mark cards as saved without fetching every article.
        Declared before `/{id}` so that route does not capture "ids".
      operationId: listBookmarkIds
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Array of article ids
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          ids:
                            type: array
                            items: { type: string, format: mongo-object-id }
        "401":
          description: Token missing or invalid
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /bookmarks/{id}:
    delete:
      tags: [Bookmarks]
      summary: Remove one bookmark
      operationId: removeBookmark
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          description: The article id, not a bookmark id.
          schema: { type: string, format: mongo-object-id }
      responses:
        "200":
          description: Bookmark removed
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          articleId: { type: string }
                          bookmarked: { type: boolean, example: false }
        "400":
          description: Malformed article ID
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "401":
          description: Token missing or invalid
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "404":
          description: The user had no such bookmark
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  # ══ Admin: sources ═══════════════════════════════════════════
  /admin/sources:
    get:
      tags: [Admin]
      summary: Every configured source
      operationId: listSources
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Sources, newest first
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: "#/components/schemas/Source"
        "401":
          description: Token missing or invalid
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "403":
          description: Authenticated but not an admin
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
    post:
      tags: [Admin]
      summary: Add a source
      description: >
        `articleLinkSelector` and `contentSelector` are required only when the
        chosen adapter reports `requiresSelectors` — site-specific adapters know
        their own page structure.
      operationId: createSource
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/SourceInput"
      responses:
        "201":
          description: Source created
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          insertedId: { type: string, format: mongo-object-id }
        "400":
          description: >
            Missing name/baseUrl, malformed URL, unknown adapter, an
            articleLimit outside 1–200, selectors missing for an adapter that
            needs them, or a duplicate baseUrl.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "403":
          description: Not an admin
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /admin/sources/{id}:
    put:
      tags: [Admin]
      summary: Update a source
      operationId: updateSource
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: mongo-object-id }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/SourceInput"
      responses:
        "200":
          description: Updated source
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/Source"
        "400":
          description: Invalid input
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "404":
          description: Source not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
    delete:
      tags: [Admin]
      summary: Remove a source
      description: >
        Articles already scraped from it are kept; they fall back to their
        stored `sourceName`.
      operationId: deleteSource
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: mongo-object-id }
      responses:
        "200":
          description: Source removed
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          deletedId: { type: string }
        "404":
          description: Source not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /admin/sources/{id}/toggle:
    patch:
      tags: [Admin]
      summary: Activate or deactivate a source
      description: >
        Inactive sources are skipped by the scheduled run. They are still
        scraped by `POST /admin/sources/{id}/scrape`, which is an explicit
        instruction.
      operationId: toggleSource
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: mongo-object-id }
      responses:
        "200":
          description: The source in its new state
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/Source"
        "404":
          description: Source not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /admin/sources/adapters:
    get:
      tags: [Admin]
      summary: Available scraping adapters
      description: >
        Drives the adapter picker. `requiresSelectors` decides whether the form
        shows the CSS selector block. Pass `url` to get a suggestion for a site.
      operationId: listAdapters
      security:
        - bearerAuth: []
      parameters:
        - name: url
          in: query
          required: false
          schema: { type: string, format: uri }
      responses:
        "200":
          description: Adapter list
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          adapters:
                            type: array
                            items:
                              $ref: "#/components/schemas/Adapter"
                          defaultAdapter: { type: string, example: generic }
                          suggested: { type: string, nullable: true }

  /admin/sources/discover-feeds:
    get:
      tags: [Admin]
      summary: Probe a site for feeds and sitemaps
      description: >
        Reports every machine-readable route a site publishes, so CSS selectors
        stay a last resort. Order of preference is feed, then sitemap, then
        selectors.

        Deliberately a suggestion rather than an automatic choice: most sites
        publish several feeds, and picking one silently would leave a source
        quietly carrying the wrong content with nothing on screen to explain it.
      operationId: discoverFeeds
      security:
        - bearerAuth: []
      parameters:
        - name: url
          in: query
          required: true
          schema: { type: string, format: uri }
      responses:
        "200":
          description: What the site offers
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/SiteProbe"
        "400":
          description: Missing or malformed url
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /admin/sources/test:
    post:
      tags: [Admin]
      summary: Dry-run a configuration against one URL
      description: >
        Stores nothing. Returns diagnostics whether or not the test passed — a
        failure is only actionable if you can see why. `pageTitle` alone usually
        settles it: "403 - Access Denied" means no selector will ever work.
      operationId: testScrape
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [url]
              properties:
                url: { type: string, format: uri, description: The article URL to test }
                name: { type: string }
                baseUrl: { type: string, description: The RSS adapter resolves the item against this feed }
                adapter: { type: string, default: generic }
                articleLinkSelector: { type: string }
                contentSelector: { type: string }
                titleSelector: { type: string }
                imageSelector: { type: string }
      responses:
        "200":
          description: Outcome plus diagnostics
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/TestScrapeResult"
        "400":
          description: Missing or malformed url
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /admin/sources/scrape-runs:
    get:
      tags: [Admin]
      summary: Scrape run history
      description: >
        Backs the System Logs screen. Retained for `SCRAPE_LOG_RETENTION_DAYS`
        (default 30) via a TTL index.
      operationId: listScrapeRuns
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema: { type: integer, minimum: 1, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
      responses:
        "200":
          description: A page of runs, newest first
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          runs:
                            type: array
                            items:
                              $ref: "#/components/schemas/ScrapeRun"
                          totalRuns: { type: integer }
                          currentPage: { type: integer }
                          pageSize: { type: integer }
                          totalPages: { type: integer }

  /admin/sources/run-scraper:
    post:
      tags: [Admin]
      summary: Run the scrape pipeline over every active source
      description: >
        Takes minutes — most of it on sources with nothing new. To populate one
        source, prefer `POST /admin/sources/{id}/scrape`.
      operationId: runScraper
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Run finished; one result per source
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: "#/components/schemas/ScrapeSourceResult"
        "409":
          description: A scrape is already in progress
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /admin/sources/{id}/scrape:
    post:
      tags: [Admin]
      summary: Scrape a single source immediately
      description: >
        Runs one source without the others. Used by the admin "Scrape now"
        button and run automatically after a source is added, since a full run
        takes minutes and spends nearly all of it on sources with nothing new.

        Scrapes the source even when inactive — asking for it by id is an
        explicit instruction, unlike the scheduled run.
      operationId: scrapeSource
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: mongo-object-id }
      responses:
        "200":
          description: Scrape finished. Note that linksDiscovered=0 with no errors is a failure.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/ScrapeSourceResult"
        "400":
          description: Malformed source ID
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "404":
          description: Source does not exist
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "409":
          description: A scrape is already in progress
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT from the OAuth callback, credential login, or guest session.

  schemas:
    # ── Envelopes ──────────────────────────────────────────────

    SuccessEnvelope:
      type: object
      required: [success, data, error]
      properties:
        success: { type: boolean, example: true }
        data: { type: "null", example: null, nullable: true }
        error: { type: "null", example: null, nullable: true }

    ErrorEnvelope:
      type: object
      required: [success, data, error]
      properties:
        success: { type: boolean, example: false }
        data: { type: "null", example: null, nullable: true }
        error:
          type: object
          required: [message, code]
          properties:
            message: { type: string }
            code:
              type: string
              enum: [BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, INTERNAL_SERVER_ERROR]

    # ── System & auth ──────────────────────────────────────────

    HealthResponse:
      allOf:
        - $ref: "#/components/schemas/SuccessEnvelope"
        - type: object
          properties:
            data:
              type: object
              properties:
                status: { type: string, example: "ok" }
                timestamp: { type: string, format: date-time }
                database: { type: string, enum: [connected, connecting, disconnecting, disconnected] }

    OAuthInitResponse:
      allOf:
        - $ref: "#/components/schemas/SuccessEnvelope"
        - type: object
          properties:
            data:
              type: object
              properties:
                authorizationUrl: { type: string, format: uri }

    LoginResponse:
      allOf:
        - $ref: "#/components/schemas/SuccessEnvelope"
        - type: object
          properties:
            data:
              type: object
              properties:
                token: { type: string }
                user:
                  type: object
                  properties:
                    id: { type: string }
                    email: { type: string, format: email, nullable: true }
                    displayName: { type: string }
                    role: { type: string, enum: [USER, ADMIN, GUEST] }

    # ── News ───────────────────────────────────────────────────

    ArticleSummary:
      type: object
      description: A feed card. `sourceName` is the source's display name.
      properties:
        id: { type: string, format: mongo-object-id }
        title: { type: string }
        thumbnailImage: { type: string, nullable: true }
        summary: { type: string }
        publishedAt: { type: string, format: date-time }
        sourceName: { type: string, example: MMO News }

    ArticleDetail:
      type: object
      properties:
        id: { type: string, format: mongo-object-id }
        title: { type: string }
        heroImage: { type: string, nullable: true }
        thumbnailImage: { type: string, nullable: true }
        contentImages:
          type: array
          items: { type: string }
        fullContent: { type: string, description: Sanitised HTML }
        summary: { type: string, description: The frontend's fallback when fullContent is empty }
        sourceName: { type: string }
        sourceUrl: { type: string, format: uri }
        category: { type: string, nullable: true }
        publishedAt: { type: string, format: date-time }
        scrapedAt: { type: string, format: date-time }

    ArticlePage:
      type: object
      properties:
        articles:
          type: array
          items:
            $ref: "#/components/schemas/ArticleSummary"
        totalArticles: { type: integer, example: 117 }
        currentPage: { type: integer, example: 1 }
        pageSize: { type: integer, example: 20 }
        totalPages: { type: integer, minimum: 1, description: At least 1, so an empty feed reads as "page 1 of 1" }

    FeedSource:
      type: object
      properties:
        id: { type: string, format: mongo-object-id }
        name: { type: string, example: MMO RPG news }
        label: { type: string, description: displayName, falling back to name, example: MMO News }
        articleCount: { type: integer, example: 30 }

    # ── Sources & adapters ─────────────────────────────────────

    Source:
      type: object
      properties:
        _id: { type: string, format: mongo-object-id }
        name: { type: string }
        displayName: { type: string, description: Shown in the UI; falls back to name }
        baseUrl: { type: string, format: uri }
        adapter: { type: string, example: rss }
        articleLimit: { type: integer, description: Per-source override for SCRAPER_ARTICLE_LIMIT }
        articleLinkSelector: { type: string }
        contentSelector: { type: string }
        titleSelector: { type: string }
        imageSelector: { type: string }
        isActive: { type: boolean }
        createdAt: { type: string, format: date-time }

    SourceInput:
      type: object
      required: [name, baseUrl]
      properties:
        name: { type: string }
        displayName: { type: string }
        baseUrl: { type: string, format: uri }
        adapter: { type: string, default: generic }
        articleLimit: { type: integer, minimum: 1, maximum: 200 }
        articleLinkSelector: { type: string }
        contentSelector: { type: string }
        titleSelector: { type: string }
        imageSelector: { type: string }
        isActive: { type: boolean, default: true }

    Adapter:
      type: object
      properties:
        key: { type: string, example: rss }
        label: { type: string, example: RSS / Atom feed }
        description: { type: string }
        requiresSelectors:
          type: boolean
          description: Whether the admin form must demand CSS selectors.

    # ── Site probing ───────────────────────────────────────────

    DiscoveredFeed:
      type: object
      properties:
        url: { type: string, format: uri }
        title: { type: string }
        itemCount: { type: integer }
        source:
          type: string
          enum: [declared, common-path, provided]
          description: "`declared` came from the page's own <link rel=\"alternate\">."

    DiscoveredSitemap:
      type: object
      properties:
        url: { type: string, format: uri }
        entryCount: { type: integer }
        isIndex: { type: boolean }
        source:
          type: string
          enum: [robots, common-path, provided]

    SiteProbe:
      type: object
      properties:
        feeds:
          type: array
          items:
            $ref: "#/components/schemas/DiscoveredFeed"
        sitemaps:
          type: array
          items:
            $ref: "#/components/schemas/DiscoveredSitemap"
        recommendedAdapter:
          type: string
          enum: [rss, sitemap, generic]
        reason: { type: string, description: Why that adapter was recommended }

    # ── Test scrape ────────────────────────────────────────────

    TestScrapeDiagnostics:
      type: object
      description: What the page actually looked like to the scraper.
      properties:
        pageTitle: { type: string, nullable: true }
        renderedChars: { type: integer }
        visibleTextChars: { type: integer }
        botChallengeDetected: { type: boolean }
        accessBlocked: { type: boolean }
        hasOgTitle: { type: boolean }
        hasOgImage: { type: boolean }
        paragraphCount: { type: integer }
        selectorMatches:
          type: object
          properties:
            articleLink: { type: integer, nullable: true }
            content: { type: integer, nullable: true }
            title: { type: integer, nullable: true }
            image: { type: integer, nullable: true }
        fetchError: { type: string, nullable: true }

    TestScrapeResult:
      type: object
      properties:
        ok: { type: boolean }
        reason: { type: string, nullable: true, description: Plain-language cause when ok is false }
        diagnostics:
          $ref: "#/components/schemas/TestScrapeDiagnostics"
        article:
          nullable: true
          allOf:
            - $ref: "#/components/schemas/ArticleDetail"

    # ── Scraping ───────────────────────────────────────────────

    ScrapeSourceResult:
      type: object
      description: >
        One source's outcome from a scrape run. `linksDiscovered: 0` with an
        empty `errors` array is a failure, not a quiet success — it is how a
        silently broken adapter presents.
      required: [sourceId, sourceName, linksDiscovered, articlesScraped, articlesSkipped, articlesRejected, errors]
      properties:
        sourceId: { type: string, format: mongo-object-id, nullable: true }
        sourceName: { type: string, example: MMO RPG news }
        linksDiscovered: { type: integer, example: 30 }
        articlesScraped: { type: integer, description: Newly stored this run, example: 30 }
        articlesSkipped: { type: integer, description: Already stored from an earlier run, example: 0 }
        articlesRejected: { type: integer, description: Fetched but judged not to be an article, example: 0 }
        errors:
          type: array
          items: { type: string }

    ScrapeRun:
      type: object
      description: One execution of the pipeline.
      properties:
        id: { type: string, format: mongo-object-id }
        trigger:
          type: string
          enum: [boot, cron, manual, source]
          description: "`source` = an admin scraped one source on its own."
        status:
          type: string
          enum: [success, partial, failed]
          description: "`partial` = the run completed but at least one source reported a problem."
        startedAt: { type: string, format: date-time }
        finishedAt: { type: string, format: date-time }
        durationMs: { type: integer }
        totalArticlesAdded: { type: integer }
        results:
          type: array
          items:
            $ref: "#/components/schemas/ScrapeSourceResult"
        error:
          type: string
          nullable: true
          description: Set when the pipeline itself threw, as opposed to a single source failing.

    # ── Data models ────────────────────────────────────────────

    User:
      type: object
      description: User entity stored in MongoDB
      properties:
        _id: { type: string, format: ObjectId }
        email: { type: string, format: email }
        displayName: { type: string }
        provider:
          type: string
          enum: [google, apple, facebook, local, guest]
        providerId: { type: string }
        role:
          type: string
          enum: [USER, ADMIN]
          default: USER
        passwordHash: { type: string, nullable: true }
        bookmarks:
          type: array
          items: { type: string, format: ObjectId }
        createdAt: { type: string, format: date-time }

    AuthPayload:
      type: object
      description: Decoded JWT payload attached to protected routes as req.user
      properties:
        sub: { type: string, description: User ID (MongoDB ObjectId as string) }
        email: { type: string, format: email }
        role: { type: string, enum: [USER, ADMIN, GUEST] }
```

---

## Quick Reference — All Endpoints at a Glance

| # | Method | Path | Auth Required | Purpose |
|---|--------|------|---------------|---------|
| 1 | `GET` | `/api/health` | No | Health probe (database status) |
| 2 | `POST` | `/api/auth/:provider` | No | Begin an OAuth flow (`google`, `apple`, `facebook`) |
| 3 | `GET` | `/api/auth/google/callback` | No | Google login redirect back to app |
| 4 | `GET` | `/api/auth/apple/callback` | No | Apple login redirect back to app |
| 5 | `GET` | `/api/auth/facebook/callback` | No | Facebook login redirect back to app |
| 6 | `POST` | `/api/auth/login` | No | Credential login — the only route reaching the seeded admin |
| 7 | `POST` | `/api/auth/guest` | No | Issue a guest session token |
| 8 | `POST` | `/api/auth/logout` | ✅ Bearer JWT | Session logout |
| 9 | `GET` | `/api/news` | No | Paginated article feed |
| 10 | `GET` | `/api/news/sources` | No | Sources with articles, for the filter pills |
| 11 | `GET` | `/api/news/:id` | No | Full article content |
| 12 | `GET` | `/api/bookmarks` | ✅ USER / ADMIN | The user's bookmarks, paginated |
| 13 | `GET` | `/api/bookmarks/ids` | ✅ USER / ADMIN | Bookmarked article ids only |
| 14 | `POST` | `/api/bookmarks` | ✅ USER / ADMIN | Bookmark an article (id in the **body**) |
| 15 | `DELETE` | `/api/bookmarks/:id` | ✅ USER / ADMIN | Remove one bookmark |
| 16 | `DELETE` | `/api/bookmarks` | ✅ USER / ADMIN | Clear all bookmarks |
| 17 | `GET` | `/api/admin/sources` | ✅ ADMIN | List every configured source |
| 18 | `POST` | `/api/admin/sources` | ✅ ADMIN | Add a source |
| 19 | `PUT` | `/api/admin/sources/:id` | ✅ ADMIN | Update a source |
| 20 | `DELETE` | `/api/admin/sources/:id` | ✅ ADMIN | Remove a source |
| 21 | `PATCH` | `/api/admin/sources/:id/toggle` | ✅ ADMIN | Activate / deactivate a source |
| 22 | `GET` | `/api/admin/sources/adapters` | ✅ ADMIN | Available adapters (+ suggestion for a URL) |
| 23 | `GET` | `/api/admin/sources/discover-feeds` | ✅ ADMIN | Probe a site for feeds and sitemaps |
| 24 | `POST` | `/api/admin/sources/test` | ✅ ADMIN | Dry-run a config, with diagnostics |
| 25 | `GET` | `/api/admin/sources/scrape-runs` | ✅ ADMIN | Scrape run history |
| 26 | `POST` | `/api/admin/sources/run-scraper` | ✅ ADMIN | Scrape every active source |
| 27 | `POST` | `/api/admin/sources/:id/scrape` | ✅ ADMIN | Scrape one source immediately |
