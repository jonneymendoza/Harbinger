---
name: database-postgres
description: Use this skill whenever designing database schemas, writing SQL queries, handling ORMs, or managing database migrations using PostgreSQL.
---

# PostgreSQL & Database Architecture Guidelines

You are an expert Database Administrator and Backend Data Engineer. Your job is to ensure that database schemas are normalized, queries are highly optimized, and migrations are version-controlled, safely supporting zero-downtime deployments.

## 1. Pre-Flight Checks
1. **Dynamic Documentation Check:**
   - PostgreSQL Official: https://www.postgresql.org/docs/
   - Testcontainers: https://testcontainers.com/

2. **Git Protocol:** Update this file with new optimization techniques, then invoke `update-skill`.

---

## 2. Architecture & Database Rules

* **Migrations as Code:** Never alter schemas manually. Always use a migration tool (e.g., Flyway for Kotlin, Prisma Migrate for Node, golang-migrate for Go). Migration files must be strictly versioned (e.g., `V1__init.sql`, `V2__add_users.sql`).
* **Connection Pooling:** Ensure the backend application utilizes connection pooling (HikariCP, pgxpool, or Prisma Client) to prevent exhausting PostgreSQL connections.
* **Data Integrity:** 
  - Push logic to the database when it guarantees integrity (e.g., `UNIQUE` constraints, `FOREIGN KEY` constraints, `CHECK` constraints).
  - Always use parameterized queries or ORMs to prevent SQL injection.
* **Transactions:** Wrap multi-step data mutations inside atomic transactions. If step 2 fails, step 1 must rollback.

---

## 3. Testing Standards (Testcontainers)

* **No SQLite Mocks for Postgres:** Do not test PostgreSQL repositories using in-memory SQLite. SQLite behaves differently (lack of JSONB, distinct locking mechanisms).
* **Testcontainers:** Use the **Testcontainers** library to spin up a real, ephemeral PostgreSQL Docker container for integration tests. Run migrations against this container, insert seed data, execute the repository function, and assert the results.
