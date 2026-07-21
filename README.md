# Harbinger — News Aggregator System

A decoupled, containerized news aggregation system that scrapes content from gaming and community websites, stores cleaned article snapshots in MongoDB, and serves them via a REST API to a modern Next.js web frontend.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
  [Project Structure](#project-structure)
- [Features](#features)
  - [Scraping Engine](#scraping-engine)
  - [REST API](#rest-api)
  - [Authentication](#authentication)
  - [Admin Panel](#admin-panel)
  - [Web Frontend](#web-frontend)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Setup](#local-setup)
  - [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
  - [Authentication Endpoints](#authentication-endpoints)
  - [News Endpoints](#news-endpoints)
  - [Bookmark Endpoints](#bookmark-endpoints)
  - [Admin Endpoints](#admin-endpoints)
- [Database Schemas](#database-schemas)
- [Deployment](#deployment)
  - [TrueNAS (Self-Hosted)](#truenas-self-hosted)
  - [AWS Cloud Migration](#aws-cloud-migration)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

Harbinger builds on a **Client-Server-Database** architecture with an asynchronous scraping engine. The system:

1. Fetches a list of configured target sources from MongoDB.
2. Uses Playwright (headless browsers) to scrape articles from each source.
3. Cleans and normalizes the content into structured JSON snapshots.
4. Stores those snapshots in MongoDB.
5. Exposes all data and user functionality through a REST API consumed by a Next.js frontend and future mobile apps.

The design is fully **containerized** via Docker so it can be deployed locally on TrueNAS and migrated to AWS with minimal effort.

---

## System Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Frontend    │◄────│  Backend Server  │◄────│   MongoDB    │
│ (Next.js)    │     │  (Express +      │     │              │
│              │◄────│   Playwright     │     │              │
│              │     │   Scraping Engine)│    │              │
└──────────────┘     └──────────────────┘     └──────────────┘
                        ▲ Cron Scheduler
                        │
                  External Web Sources
               (e.g. RSA, Arsenal FC)
```

### Components

| Component | Role |
|-----------|------|
| **Backend Server** | Express API server + Playwright scraping engine + cron scheduler |
| **Database** | MongoDB for articles, sources, users, and bookmarks |
| **Web Frontend** | Next.js + Tailwind CSS with Dark/Light theming and responsive layout |
| **Mobile App (Future)** | Consumes the same REST API as the web frontend |

---

## Tech Stack

| Layer          | Technology              | Reason                                     |
|----------------|-------------------------|--------------------------------------------|
| **Backend**    | Node.js / Express       | Rapid development, native JS support      |
| **Scraping**   | Playwright (Headless)   | Handles dynamic/JS-heavy content           |
| **Scheduler**  | node-cron               | Automated hourly scraping jobs             |
| **Database**   | MongoDB                 | Flexible schema for varied article structures |
| **Frontend**   | Next.js / Tailwind CSS  | SSR for SEO, dark mode, fast performance   |
| **Authentication** | Passport.js / OAuth 2.0 | Google, Apple, and Facebook social logins  |
| **Container**  | Docker / Docker Compose | Consistent environments across dev → prod  |

---

## Project Structure

```
Harbinger/
├── PRD.md              # Product Requirements Document
├── LICENSE
├── README.md           # This file
├── specs/
│   ├── backend-scrapper.md   # Scraping engine & pipeline spec
│   ├── api-endpoints.md      # REST API contract
│   ├── api-auth.md           # Auth & security spec
│   ├── admin-panel.md        # Admin panel spec
│   ├── frontend-ui.md        # Frontend UI/UX spec
│   └── deployment-docker.md# Docker & infra spec
├── docker-compose.yml      # Multi-container orchestration
└── .env                    # Environment variable configuration
```

---

## Features

### Scraping Engine

- **Autonomous & Scheduled**: Runs every 60 minutes via `node-cron`.
- **Dynamic Sources**: Fetches active scraping targets from the database — no redeploy required.
- **Content Pipeline**:
  1. Retrieve active sources from MongoDB.
  2. Navigate each source with a Playwright browser instance.
  3. Extract article links using configurable CSS selectors.
  4. Deep-scrape each article (await network idle for JS-rendered content).
  5. Clean HTML — strip scripts, styles, and ads.
  6. Normalize dates to ISO 8601; ensure absolute image URLs.
  7. Upsert into the `articles` collection via source URL to avoid duplicates.

#### Resiliency & Anti-Block Measures
| Measure        | Description                              |
|----------------|------------------------------------------|
| User Agent Rotation      | Cycles through common browser user agents    |
| Request Throttling       | Random 1–5 s delay between scrapes         |
| Concurrency Limits       | Max ~3 open pages to avoid memory spikes   |

#### Stored Article Fields

```json
{
  "sourceId": "ObjectId",
  "sourceUrl": "String (Unique)",
  "title": "String",
  "heroImage": "String (URL)",
  "thumbnailImage": "String (URL)",
  "contentImages": ["String"],
  "fullContent": "Cleaned HTML/Markdown",
  "summary": "String",
  "category": "String",
  "publishedAt": "Date",
  "scrapedAt": "Date"
}
```

#### Initial Target Sources

| Source | URL |
|--------|-----|
| Roberts Space Industries | `https://robertsspaceindustries.com/community-hub/discover` |
| Arsenal News             | `https://www.arsenal.com/news/all/1`               |

New sources can be added anytime through the Admin Panel.

---

### REST API

All endpoints follow RESTful design with a standard JSON response wrapper:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Pagination uses **limit-offset** strategy throughout.

See `specs/api-endpoints.md` for full API contract details. Below is a quick reference summary.

### Authentication Endpoints

| Method | Endpoint                | Description              |
|--------|-------------------------|--------------------------|
| POST   | `/auth/google`          | Google OAuth 2.0 login   |
| POST   | `/auth/apple`           | Apple Sign-In            |
| POST   | `/auth/facebook`        | Facebook Login           |

Each returns a **JWT** valid for 30 days (HS256 signed).

---

### News Endpoints (Public)

| Method   | Endpoint                   | Description                  |
|----------|----------------------------|------------------------------|
| GET      | `/api/news?page=&limit=`   | Paginated list of articles   |
| GET      | `/api/news/:id`            | Full article content         |

#### Article List Response Fields
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

---

### Bookmark Endpoints (Authenticated)

Requires `Authorization: Bearer <JWT>`.

| Method | Endpoint                  | Description                      |
|--------|---------------------------|----------------------------------|
| GET    | `/api/bookmarks`          | Fetch user's bookmarks           |
| POST   | `/api/bookmarks`          | Save an article (`articleId`)    |
| DELETE | `/api/bookmarks/:id`      | Remove a bookmark                |

---

### Admin Endpoints (Admin JWT only)

Requires `Authorization: Bearer <JWT>` + `role: "ADMIN"` claim.

| Method  | Endpoint                       | Description                        |
|---------|--------------------------------|------------------------------------|
| GET     | `/api/admin/sources`           | List all scraping targets          |
| POST    | `/api/admin/sources`           | Add a new target website           |
| PUT     | `/api/admin/sources/:id`       | Update source configuration         |
| DELETE  | `/api/admin/sources/:id`       | Remove a target website            |
| POST    | `/api/admin/sources/test`      | Live-test CSS selectors (dev feature) |

---

## Database Schemas

### Source Collection (`sources`)

```json
{
  "_id": "ObjectId",
  "name": "String",
  "baseUrl": "URL",
  "articleLinkSelector": "CSS Selector",
  "contentSelector": "CSS Selector",
  "titleSelector": "CSS Selector",
  "imageSelector": "CSS Selector",
  "isActive": "Boolean",
  "createdAt": "Date"
}
```

### Article Collection (`articles`)

```json
{
  "_id": "ObjectId",
  "sourceId": "ObjectId",
  "sourceUrl": "String (Unique Index)",
  "title": "String",
  "heroImage": "String",
  "thumbnailImage": "String",
  "contentImages": ["String"],
  "fullContent": "Cleaned HTML/Markdown",
  "summary": "String",
  "category": "String",
  "publishedAt": "Date",
  "scrapedAt": "Date"
}
```

### User Collection (`users`)

```json
{
  "_id": "ObjectId",
  "email": "String (Unique, Indexed)",
  "displayName": "String",
  "provider": "google | apple | facebook | local",
  "providerId": "String",
  "role": "USER | ADMIN",
  "passwordHash": "String (optional)",
  "bookmarks": ["ObjectId"],
  "createdAt": "Date"
}
```

---

## Frontend

Built with **Next.js** and **Tailwind CSS**.

### Design System

#### Theming (Dark / Light Mode)
| Element         | Light Mode                     | Dark Mode                        |
|-----------------|--------------------------------|----------------------------------|
| Background      | `#F8FAFC` (near-white)         | `#020617` (deep charcoal)        |
| Surface / Tiles  | White + soft shadow            | `#0F172A` + thin border          |
| Primary Text    | Dark Slate                     | Off-white (`#E2E8F0`)            |
| Accents         | Indigo / Royal Blue            | Neon Cyan / Electric Violet      |

### Page Routes

| Route           | Component       | Access         |
|-----------------|-----------------|----------------|
| `/`             | Home / Feed     | Public         |
| `/article/:id`   | Article View    | Public         |
| `/bookmarks`     | Bookmarks List  | Authenticated  |
| `/auth/login`    | Social Login    | Public         |
| `/admin`         | Admin Dashboard | Admin Only     |

#### Responsive Breakpoints

| Device    | Breakpoint       | Layout             |
|-----------|------------------|--------------------|
| Mobile    | `< 640px`        | Single-column grid |
| Tablet    | `640–1024px`     | Two-column grid    |
| Desktop   | `> 1024px`       | Multi-column grid  |

#### Key UX Features
- **Glassmorphism** navbar with backdrop blur.
- **Skeleton loading** placeholders during API fetches (prevents CLS).
- **next/image** for responsive, lazy-loaded thumbnails with WebP conversion.
- Client-side caching via SWR / React Query to reduce redundant API requests.
- Dark/Light mode toggle with smooth 300 ms transition animations.

---

## Admin Panel

A protected dashboard within the web frontend for managing scraping targets without touching code or the database directly.

### Features
- **Source Table** — Name, URL, status, creation date, and action buttons.
- **Editor Form** — Add / edit configuration (CSS selectors for links, title, image).
- **Live "Test Scrape"** — Preview scraped output before saving broken selectors.
- **Role Gate** — Only `role: "ADMIN"` users with a valid JWT can enter.

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- Docker & Docker Compose
- MongoDB Atlas cluster or local MongoDB instance

### Local Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd Harbinger

# 2. Create environment configuration
cp .env.example .env
# Edit .env with your secrets and database connection string (see below)

# 3. Start all services
docker-compose up -d

# 4. Verify
curl http://localhost:5000/api/news
```

### Environment Variables

| Variable                    | Description                          | Example                              |
|-----------------------------|--------------------------------------|--------------------------------------|
| `MONGO_URI`                 | MongoDB connection string              | `mongodb://mongo:27017/news-aggr`     |
| `JWT_SECRET`                | JWT signing secret (HS256)            | *(randomly generated long string)*    |
| `ADMIN_USER`                | Initial admin username / email         | `admin@example.com`                  |
| `ADMIN_PASS`                | Initial admin password (BCrypt hash)  | `$2b$10$...`                         |
| `GOOGLE_CLIENT_ID`          | Google OAuth Client ID                 | `xxxxx.apps.googleusercontent.com`   |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth Client Secret             | `GOCSPX-xxxxx`                       |
| `APPLE_CLIENT_ID`           | Apple Sign-In Team ID / Key            | —                                    |
| `FACEBOOK_APP_ID`           | Facebook Login App ID                  | —                                    |
| `NEXT_PUBLIC_API_URL`       | API endpoint for the frontend          | `http://localhost:5000/api`           |

> The master admin account is auto-created on **first server startup** if no admin user exists in the database.

---

## Deployment

### TrueNAS (Self-Hosted) — Phase 1

```bash
docker-compose up -d
```

Optional reverse proxy with Nginx Proxy Manager for local domain access.

### AWS Cloud Migration — Phase 2

| Option              | Service       | When to Use                             |
|---------------------|---------------|------------------------------------------|
| Low Complexity      | Amazon ECS (Fargate) | No server management needed         |
| High Scalability    | Amazon EKS (Kubernetes) | Large user/source base, auto-scaling needs |

- Replace MongoDB container with **MongoDB Atlas** for managed backups and reliability.

---

## Roadmap

| Phase | Title                  | Description                                        |
|-------|------------------------|----------------------------------------------------|
| 1     | Development           | Local setup, scraper validation, core API          |
| 2     | Testing               | Docker Compose deployment on TrueNAS               |
| 3     | Cloud Migration       | Migrate to AWS (ECS/EKS + Atlas) for production    |

### Planned Future Enhancements
- **Scraping Logs** — View hourly cron job output per source.
- **User Management** — Promote/demote users via admin panel.
- **Mobile App** — Native iOS/Android consuming the REST API.
- **AWS Infrastructure** — Full auto-scaling setup with EKS + RDS / Atlas.

---

## Error Code Map

| HTTP Code | Internal Code     | Meaning                              |
|-----------|--------------------|--------------------------------------|
| 400       | `BAD_REQUEST`      | Invalid params or malformed JSON     |
| 401       | `UNAUTHORIZED`     | Token missing, expired, or invalid   |
| 403       | `FORBIDDEN`        | Authenticated but lacks ADMIN role   |
| 404       | `NOT_FOUND`        | Article or source ID not found       |
| 500       | `SERVER_ERROR`     | Database crash or internal failure   |

---

## Specifications Reference

Full specification documents live in the `specs/` directory:

| Document              | Path                                |
|-----------------------|--------------------------------------|
| Scraping Engine       | [`specs/backend-scrapper.md`](./specs/backend-scrapper.md) |
| API Endpoints         | [`specs/api-endpoints.md`](./specs/api-endpoints.md) |
| Authentication & Auth | [`specs/api-auth.md`](./specs/api-auth.md) |
| Admin Panel           | [`specs/admin-panel.md`](./specs/admin-panel.md) |
| Frontend UI / UX      | [`specs/frontend-ui.md`](./specs/frontend-ui.md) |
| Docker Deployment     | [`specs/deployment-docker.md`](./specs/deployment-docker.md`) |

---

## License

See [LICENSE](./LICENSE) for details.
