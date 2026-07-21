# Feature Specification: API Authentication & Security

## 1. Overview
This system implements a secure, stateless authentication layer using OAuth 2.0 and JSON Web Tokens (JWT). It manages three distinct tiers of users: Unauthenticated guests, Registered Users, and Administrators.

## 2. Technical Implementation

### A. Identity Providers (Social Login)
The backend will use **Passport.js** to integrate with the following providers:
*   **Google OAuth 2.0:** Using `passport-google-oauth20`.
*   **Apple ID:** Using `passport-apple` (requires a Developer Account for private keys).
*   **Facebook Login:** Using `passport-facebook`.

**The Flow:**
1.  Client redirects user to the Social Provider login page.
2.  Provider returns an authorization code to the Backend callback endpoint.
3.  Backend exchanges code for a profile (Email, Name, Unique ID).
4.  Backend checks if the user exists in MongoDB; if not, it creates a new User record.
5.  Backend generates and returns a JWT token to the client.

### B. Token Management (JWT)
The system will use **JWTs** for all authenticated requests.

*   **Algorithm:** HS256 (Symmetric signing using a `JWT_SECRET` environment variable).
*   **Payload Structure:**
    ```json
    {
      "sub": "userId",
      "email": "user@example.com",
      "role": "USER | ADMIN",
      "iat": 1625000000,
      "exp": 1625864000
    }
    ```
*   **Expiration:** Tokens will be valid for 30 days to minimize frequent re-logins on the mobile app.
*   **Storage:** Client stores JWT in `localStorage` (Web) or Secure Storage (Mobile).

### C. Administrative Bootstrap & Access Control
To ensure a secure administrative layer without needing an external panel for initial setup:

1.  **Bootstrap Process:** 
    *   Upon server startup, the system checks if any user with the `ADMIN` role exists in the database.
    *   If none exist, it reads `ADMIN_USER` and `ADMIN_PASS` (hashed) from the `.env` file.
    *   It automatically creates a master admin account in MongoDB using these credentials.
2.  **Role-Based Access Control (RBAC):**
    *   A middleware function `checkRole(requiredRole)` will intercept requests to `/api/admin/*`.
    *   The middleware decodes the JWT and verifies if the `role` claim matches `ADMIN`.

## 3. Database Schema: User Collection (`users`)
```json
{
  "_id": "ObjectId",
  "email": "String (Unique, Indexed)",
  "displayName": "String",
  "provider": "String (google | apple | facebook | local)",
  "providerId": "String (The unique ID from the social provider)",
  "role": "String (USER | ADMIN)",
  "passwordHash": "String (Optional, only for internal admin bootstrap)",
  "bookmarks": ["ObjectId (Reference to articles)"],
  "createdAt": "Date"
}
```

## 4. Security Requirements
*   **HTTPS:** All traffic must be encrypted via TLS/SSL in production.
*   **Secret Management:** `JWT_SECRET`, OAuth Client IDs, and Client Secrets must be stored as environment variables, never hardcoded.
*   **Input Validation:** Sanitize all inputs using a library like `joi` or `express-validator` to prevent NoSQL injection.
*   **CORS Policy:** Restrict API access to the specifically defined Web Frontend domain and the Mobile App origin.

## 5. Error Responses
| Code | Meaning | Description |
| :--- | :--- | :--- |
| `401 Unauthorized` | Missing/Invalid Token | User is not authenticated; prompt for login. |
| `403 Forbidden` | Insufficient Permissions | User is authenticated but lacks the `ADMIN` role. |
| `500 Internal Error` | Provider Failure | OAuth provider is unreachable or returned an error. |
