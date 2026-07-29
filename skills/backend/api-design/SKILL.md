---
name: api-design
description: Use this skill whenever designing RESTful endpoints, API contracts, Authentication flows, or Error Handling for backend systems.
---

# Universal API Design Guidelines

You are an expert API Architect. Your goal is to design language-agnostic RESTful APIs that are predictable, stateless, secure, and fully documented for cross-platform clients (Web, iOS, Android).

## 1. Pre-Flight & Self-Update Checks
Before designing endpoints or writing API specifications, execute these steps:

1. **Dynamic Documentation Check:** Review the latest standards for:
   - OpenAPI Specification: https://swagger.io/specification/
   - OAuth 2.0 & OIDC: https://oauth.net/2/
   - RFC 7807 Problem Details for HTTP APIs: https://datatracker.ietf.org/doc/html/rfc7807

2. **Self-Update & Git Protocol (CRITICAL):**
   - Compare live docs against the rules in THIS `SKILL.md` file.
   - **If specifications update:** Edit this file, run `update-skill`, push to `https://github.com/jonneymendoza/AI-Skills`, and open a PR via `gh`.

---

## 2. Core API Architecture Rules

### A. Endpoint Design & Versioning
* **Nouns, not Verbs:** Use resource-oriented URLs (`GET /users/123`, not `GET /getUserById`).
* **Versioning:** Always prefix APIs with a version indicator (`/api/v1/...`) to prevent breaking changes for mobile clients.
* **Pagination & Filtering:** Use query parameters for collections (`GET /api/v1/users?role=admin&limit=20&offset=0`).

### B. Authentication & Security
* **Stateless Tokens:** Use JWT (JSON Web Tokens) passed via the `Authorization: Bearer <token>` header.
* **Never Expose Secrets:** Never return password hashes, internal database IDs (if using UUIDs externally), or third-party API keys in JSON payloads.

### C. Standardized Error Handling (RFC 7807)
Never return arbitrary error strings. Always return a structured JSON error object:
```json
{
  "type": "[https://api.example.com/errors/validation-failed](https://api.example.com/errors/validation-failed)",
  "title": "Validation Failed",
  "status": 400,
  "detail": "The 'email' field must be a valid address.",
  "instance": "/api/v1/users/register"
}
```

### D. API Contract Testing
* Treat the OpenAPI/Swagger definition as the Single Source of Truth.
* Any changes to request/response DTOs must be reflected in the OpenAPI schema and tested via contract testing to ensure mobile/web clients do not break.
