# Harbinger Backend API — OpenAPI 3.0 Specification

> **Base URL:** `http://localhost:8082/api` (Docker) / Development: `http://localhost:5000/api`

---

## Table of Contents

- [Authentication](#authentication)
- [Health Check](#health-check)
- [Auth — OAuth Flows](#auth--oauth-flows)
- [Auth — Logout](#auth--logout)
- [Response Schema](#response-schema)
- [Error Codes](#error-codes)

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
  version: "0.1.0"
  description: Backend API for the Harbinger news aggregator — OAuth auth, health introspection, and (future) admin/scraper endpoints.
servers:
  - url: http://localhost:8082/api
    description: Docker / production
  - url: http://localhost:5000/api
    description: Local development

paths:
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

  /auth/{provider}:
    post:
      tags: [Auth]
      summary: Initiate OAuth 2.0 flow for the given provider
      description: Returns a URL that the frontend should redirect the user to. No auth required.
      operationId: initiateOAuth
      parameters:
        - name: provider
          in: path
          required: true
          schema:
            type: string
            enum: [google, apple, facebook]
          description: OAuth provider
      responses:
        "200":
          description: Auth URL returned successfully
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/OAuthInitResponse"
        "400":
          description: Unsupported provider
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "500":
          description: OAuth init failure
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /auth/google/callback:
    get:
      tags: [Auth]
      summary: Google OAuth callback
      operationId: googleCallback
      responses:
        "200":
          description: Login successful, JWT returned
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LoginResponse"
        "401":
          description: Authentication failed
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "500":
          description: Provider callback error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /auth/apple/callback:
    get:
      tags: [Auth]
      summary: Apple Sign-In callback
      operationId: appleCallback
      responses:
        "200":
          description: Login successful, JWT returned
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LoginResponse"
        "401":
          description: Authentication failed
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "500":
          description: Provider callback error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /auth/facebook/callback:
    get:
      tags: [Auth]
      summary: Facebook OAuth callback
      operationId: facebookCallback
      responses:
        "200":
          description: Login successful, JWT returned
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LoginResponse"
        "401":
          description: Authentication failed
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"
        "500":
          description: Provider callback error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorEnvelope"

  /auth/logout:
    post:
      tags: [Auth]
      summary: Logout (invalidate current session)
      description: Currently returns a generic success. JWTs are unforgeable by design; this may be extended for token revocation in the future.
      operationId: logout
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Logout successful
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SuccessEnvelope"
        "401":
          description: Missing or invalid token
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
      description: JWT returned by the OAuth callback endpoints.

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
            code: { type: string }

    # ── Endpoint-Specific ──────────────────────────────────────

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

    # ── Data Models ────────────────────────────────────────────

    User:
      type: object
      description: User entity stored in MongoDB
      properties:
        _id: { type: string, format: ObjectId }
        email: { type: string, format: email }
        displayName: { type: string }
        provider:
          type: string
          enum: [google, apple, facebook, local]
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
        role: { type: string, enum: [USER, ADMIN] }
```

---

## Quick Reference — All Endpoints at a Glance

| # | Method | Path | Auth Required | Purpose |
|---|--------|------|---------------|---------|
| 1 | `GET` | `/api/health` | No | Health probe (database status) |
| 2 | `POST` | `/api/auth/google` | No | Initiate Google OAuth flow |
| 3 | `POST` | `/api/auth/apple` | No | Initiate Apple Sign-In flow |
| 4 | `POST` | `/api/auth/facebook` | No | Initiate Facebook OAuth flow |
| 5 | `GET` | `/api/auth/google/callback` | No | Google login redirect back to app |
| 6 | `GET` | `/api/auth/apple/callback` | No | Apple login redirect back to app |
| 7 | `GET` | `/api/auth/facebook/callback` | No | Facebook login redirect back to app |
| 8 | `POST` | `/api/auth/logout` | ✅ Bearer JWT | Session logout |
