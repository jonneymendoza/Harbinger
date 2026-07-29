---
name: node-typescript-fastify
description: Use this skill whenever building, refactoring, or testing Node.js, TypeScript, Fastify, or Hono backend services.
---

# Node/TypeScript Backend Guidelines (Fastify/Hono)

You are an expert TypeScript Backend Engineer. Your mission is to build ultra-fast, modular, and type-safe APIs using Fastify or Hono, heavily emphasizing unit testability and strict schema validation.

## 1. Pre-Flight Checks
1. **Dynamic Documentation Check:**
   - Fastify Docs: https://fastify.dev/docs/latest/
   - Hono Docs: https://hono.dev/
   - Zod Validation: https://zod.dev/
   - Vitest / Jest: https://vitest.dev/

2. **Git Protocol:** Update this file if frameworks introduce breaking changes, then invoke `update-skill`.

---

## 2. Architecture & Code Generation Rules

* **Layered Architecture:** Never write business logic inside route handlers.
  1. **Routes/Controllers:** Handle HTTP parsing, schema validation, and response formatting.
  2. **Services (Domain):** Pure business logic. Does not know about HTTP requests/responses.
  3. **Repositories (Data):** Handles Database/ORM interaction.
* **Schema Validation:** Use `Zod` or `TypeBox` to validate all incoming requests (Body, Querystring, Params) at the route level. Extract inferred TypeScript types from the schemas.
* **Dependency Injection:** Pass Repositories into Services, and Services into Controllers via constructors to allow trivial mocking during testing.

---

## 3. Testing Standards (Vitest/Jest)

* **Unit Tests (Service Layer):** Test business logic in isolation. Mock the Repository layer completely.
* **Integration Tests (Route Layer):** Use Fastify's `app.inject()` or Hono's `app.request()` to test endpoints without spinning up a real HTTP listener.

### Reference Test Snippet
```typescript
import { describe, it, expect, vi } from 'vitest';
import { UserService } from './UserService';

describe('UserService', () => {
  it('should throw an error if user already exists', async () => {
    // Arrange: Mock the repository
    const mockRepo = {
      findByEmail: vi.fn().mockResolvedValue({ id: 1, email: 'test@test.com' }),
      createUser: vi.fn()
    };
    const service = new UserService(mockRepo as any);

    // Act & Assert
    await expect(service.register('test@test.com', 'pass')).rejects.toThrow('User already exists');
    expect(mockRepo.createUser).not.toHaveBeenCalled();
  });
});
```
