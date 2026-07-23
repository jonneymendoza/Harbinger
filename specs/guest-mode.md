# Feature Specification: Guest Mode

## 1. Overview
Guest Mode allows visitors to browse the Harbinger news feed and read articles without creating an account or using OAuth providers. It provides a frictionless onboarding path: users can experience the full feed, then optionally sign up or "upgrade" their guest session into a registered account later.

The system manages three identity tiers (per PRD §4.C):
1. **Guest** — fully anonymous, short-lived token, read-only access.
2. **RegisteredUser** — authenticated via OAuth or local credentials, full interactivity including bookmarks.
3. **Admin** — registered user with elevated privileges for source management.

## 2. Goals
- Allow immediate value for first-time visitors (browse feed, read articles).
- Remove the hard requirement of social login to access public content.
- Provide a seamless path from guest → registered (upgrade option on every authenticated-only action).
- Keep security tight: guests get short-lived tokens with restricted claims.

## 3. Functional Requirements

### 3.1 Backend — Guest Token Issuance
* **Endpoint:** `POST /api/auth/guest` (no auth required)
* **Request Body:** None
* **Response:** `{ success: true, data: { token: "<jwt>", expiresAt: "ISO-8601" }, error: null }`
* **Behavior:**
  1. Generate a UUID v4 for the `sub` claim (anonymous user ID).
  2. Set `role: 'GUEST'`, `email: null`, `displayName: 'Guest'.`
  3. Issue a JWT with `role: GUEST` and `expiresIn: '7d'` using HS256.
  4. In MongoDB, upsert a **User** document with `provider: 'guest'`, `providerId: <uuid>`, `role: USER`, `createdAt: now`. (Guest session tokens are short-lived; the user doc persists the fact that we've met this device before.)
  5. Return the JWT to the client.

### 3.2 Backend — Guest Endpoint Access
* **Public endpoints** (accessible with or without any token):
    * `GET /api/health`
    * `GET /api/news`
    * `GET /api/articles/:id`
* **Authenticated-only endpoints:**
    * Bookmarks (`POST`, `GET`, `DELETE`) — requires `role: USER` or `ADMIN`. Guests (role `GUEST`) attempting these receive `403` with a message directing them to upgrade.
    * Admin endpoints — require `ADMIN` role.

### 3.3 Frontend — Guest Flow
* **Landing Page:** The home page (`(public)/page.tsx`) must always render the feed grid regardless of auth state. Add a prominent "Continue as Guest" button alongside (or instead of) the Login button for unauthenticated visitors.
* **Auth State:** `AuthContext` will now track three states:
    * `isAuthenticated: true, user.role === 'USER' | 'ADMIN'` — fully logged in.
    * `isGuest: true, user.role === 'GUEST'` — browsing as guest (holds a valid guest JWT).
    * `anonymous` — neither token stored (rare, only on first visit before POST /auth/guest).
* **API Client:** The client must distinguish between public and protected endpoints. For **public** endpoints (`/api/news`, `/api/articles/:id`), 401 errors should **not** trigger a redirect to login. Only bookmark or admin API calls get the "please log in" response on 401/403.
* **"Upgrade" Prompt:** When a guest tries to bookmark an article, display a modal/banner: _"Save articles by creating an account. [Sign up] or just keep browsing as a guest."_ No data is lost — their feed state persists across the upgrade.

### 3.4 Guest Token Lifecycle
| Property | Value |
|---|---|
| Algorithm | HS256 (same JWT_SECRET) |
| Expiry | 7 days (`JWT_EXPIRY_GUEST` env var, default `7d`) |
| Payload | `{ sub: <uuid>, email: null, role: 'GUEST' }` |
| Storage | localStorage key `harbinger_token` (same as registered users) |
| Auto-renewal | If the guest JWT is expired but the user doc in MongoDB still exists with `provider: 'guest'`, call `/api/auth/guest` again silently in the background to refresh the token. |

## 4. Database Schema Update — User Collection (existing, extended)

```json
{
  "_id": "ObjectId",
  "email": "String (Nullable)",
  "displayName": "String",
  "provider": "String (google | apple | facebook | local | guest)",
  "providerId": "String (UUID for guest, OAuth ID provider for others)",
  "role": "String (USER | ADMIN) — *guest tokens use GUEST role but user-doc is USER*",
  "passwordHash": "String (Nullable)",
  "bookmarks": ["ObjectId"],
  "createdAt": "Date"
}
```

When a **registered user** upgrades from guest:
1. On signup/login, look for an existing `providerId` matching the current `provider` and copy bookmarks if any existed previously.
2. Set `email` to the OAuth-returned email (or form input).
3. Set `role: USER`.

## 5. API Contract Updates (Swagger addition)

### POST `/api/auth/guest` — Guest Login

```http
POST /api/auth/guest
```

#### Response — `200 OK`
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2026-07-29T15:30:00.000Z"
  },
  "error": null
}
```

| Field | Type | Description |
|---|---|---|
| `data.token` | string | JWT bearer token (role: GUEST, expiresIn: 7d) |
| `data.expiresAt` | string | ISO-8601 timestamp of token expiry |

#### Error Response — `500 Server Error`
```json
{
  "success": false,
  "data": null,
  "error": { "message": "Failed to issue guest session", "code": "GUEST_ISSUE_ERROR" }
}
```

## 6. Security Considerations
* **Token Scope:** Guest tokens carry `role: GUEST` which is *not* in the allowed roles for any write endpoint — only read endpoints work.
* **No Privilege Escalation:** The guest JWT payload does not contain an email or role of USER/ADMIN, preventing any token forgery attack from escalating privileges.
* **Rate Limiting:** Guest issuance is rate-limited via the existing global `rateLimit` middleware (100 req/15 min per IP).
* **Data Isolation:** Each guest gets a unique UUID (`sub` / `providerId`). No data shares between different guest sessions.

## 7. Frontend UI Wireframe — Landing Page

```
┌──────────────────────────────────────────────┐
│               Harbinger                       │
│   Your personalized news aggregation platform │
│                                              │
│  [ Continue as Guest ]   [ Login ]           │
│                                              │
│        ↓ feed grid (always visible)            │
└──────────────────────────────────────────────┘
```

On guest mode:
- Navbar shows **"Guest"** or a generic avatar icon alongside Theme toggle.
- Bookmark icons on articles show a lock/ghost hint: _"Upgrade to save."_
- Clicking "Login" while in guest mode opens the login card with a banner: _"Already browsing as Guest? You can link your account later."_

## 8. Edge Cases
| Scenario | Behavior |
|---|---|
| Guest tries to bookmark | Server returns `403` + message. Frontend shows upgrade prompt. |
| Token expires while viewing feed | Auto-refresh via silent `POST /auth/guest` call; seamless. |
| Guest → signs up OAuth same day | Existing guest user doc updated with email/provider info; bookmarks carried over if they upgraded before signing up. |
| Guest clears localStorage | Treated as first visit; next page load calls `/auth/guest` automatically. |
