# Local Development Setup Guide

## Prerequisites

- Docker Desktop installed and running on your Mac [https://www.docker.com/products/docker-desktop/]
- Git (for cloning the repo if needed)

## Quick Start

### 1. Navigate to the project directory

```bash
cd /Users/jonathan/Work/Harbinger
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and set **at minimum**:

```env
ADMIN_USER=admin@example.com
ADMIN_PASS=Admin@123!
JWT_SECRET=random_string_longer_than_32_chars
MONGO_URI=mongodb://localhost:27017/news-aggregator
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=http://localhost:5000/api
SERVER_PORT=5000
```

OAuth values (`GOOGLE_*`, `APPLE_*`, `FACEBOOK_*`) can be left empty — you don’t need them until Phase 2.

### 3. Build and start all containers

```bash
docker compose up --build
```

**Startup sequence (~30 seconds):**

```
[+] Running 4/4
 ✔ Container harbingermongo    Started        (MongoDB runs health check first)
 ✔ Container harbingbackend    Started        
 ✔ Container harbingfrontend   Started        
 ✔ Network harboringer_backend-net   Created

harbingbackend 🌱 Express listening on http://0.0.0.0:5000
harbingbackend ⚙️ Admin user seeded: admin@example.com
harbingfrontend ✨ Ready at http://0.0.0.0:3000
```

Press `Ctrl+C` to stop the interactive logs. The containers keep running in the background after that point — use `docker compose logs -f` to view them again.

## Verify Everything Is Working

### API health check

```bash
curl localhost:5000/api/health
# Expected: {"status":"ok","timestamp":"2026-..."}
```

### Open the app in your browser

| Where | URL | What you'll see |
|---|---|---|
| Home page | `http://localhost:3000` | Blank feed (no sources configured yet) |
| Login page | `http://localhost:3000/auth/login` | "Login with Google" / Apple / Facebook buttons |
| Admin panel | `http://localhost:3000/admin` | Requires admin login first — see below |

### Test backend directly

```bash
curl localhost:5000/api/news
# Expected (valid empty response, confirms API works):
# {"success":true,"data":[],"error":null}
```

### First admin login

1. Go to `http://localhost:3000/auth/login`
2. Log in with the `ADMIN_USER` and `ADMIN_PASS` you set in `.env`
3. Navigate to `/admin` — your admin dashboard will appear

## What Comes Next (Interactive)

Once everything is up, complete these steps in order:

1. Visit `/admin` → add a source (URL + CSS selectors from `specs/backend-scrapper.md`)
2. Click **"Test Scrape"** to validate your selectors
3. Wait ~1 minute or trigger a manual scrape — articles populate in your feed
4. Log out, browse the feed as an anonymous user, try bookmarking articles

## Useful Docker Commands

| Command | What it does |
|---|---|
| `docker compose logs -f` | Tail all container logs |
| `docker compose ps` | Verify all 3 containers are running |
| `docker compose down` | Stop and remove containers (data persists in volume) |
| `docker exec -it harbingbackend sh` | Open bash inside the backend container for debugging |
| `docker compose restart mongodb` | Restart only Mongo (e.g., to clear stale connections) |

## Troubleshooting

### Containers refuse to start

```bash
docker compose down --volumes   # wipes DB data! Use as last resort
docker buildx prune -f           # clean stuck build cache
docker compose up --build        # fresh attempt
```

### CORS errors in the browser

Make sure `ALLOWED_ORIGINS` in `.env` includes both:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Backend won't connect to MongoDB

Verify Mongo is healthy before starting backend:
```bash
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"
# Expected: {"ok": 1}
```

### Port already in use

Check what's using the ports:
```bash
lsof -i :5000  # Backend port — change SERVER_PORT in .env if needed
lsof -i :3000  # Frontend port — change NEXT_PUBLIC_API_PORT if needed
```

## Migrating to TrueNAS Later

When it's time to deploy:

1. Transfer this folder via git or `rsync` to your TrueNAS server
2. Copy `.env.example` → `.env`, fill in values for **production** (different JWT_SECRET, etc.)
3. Run `docker compose up -d --build` on the server — same commands as above
