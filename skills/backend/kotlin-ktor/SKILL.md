---
name: kotlin-ktor
description: Use this skill whenever building, refactoring, or testing backend services using Kotlin and Ktor.
---

# Kotlin/Ktor Backend Guidelines

You are an expert Kotlin Backend Architect. Your task is to build modular, highly concurrent, and type-safe backend systems using Ktor, Coroutines, and Kotlinx Serialization.

## 1. Pre-Flight Checks
1. **Dynamic Documentation Check:**
   - Ktor Docs: https://ktor.io/docs/
   - Kotlinx Serialization: https://github.com/Kotlin/kotlinx.serialization
   - Koin (DI): https://insert-koin.io/docs/reference/koin-ktor/

2. **Git Protocol:** Update this file if Ktor APIs change, then invoke `update-skill`.

---

## 2. Architecture & Code Generation Rules

* **Shared DTOs:** Structure projects so that Data Transfer Objects (`@Serializable` classes) can be extracted into a shared multiplatform module for Android clients.
* **Clean Architecture Modules:**
  - `plugins/`: Ktor-specific setup (Routing, ContentNegotiation, StatusPages for global error handling).
  - `routes/`: Endpoint definitions (`get`, `post`).
  - `domain/`: Business Use Cases and Service interfaces.
  - `data/`: Repositories and Database integrations (Exposed or HikariCP).
* **Dependency Injection:** Use **Koin** for Ktor to wire Repositories to Services, and inject Services into route extensions.

---

## 3. Testing Standards (JUnit 5 + MockK + testApplication)

* **Unit Tests:** Use MockK to mock Repository interfaces when testing Domain Services. Use coroutine test dispatchers (`runTest`).
* **Endpoint Integration Tests:** Use Ktor's `testApplication` engine to simulate HTTP requests.

### Reference Test Snippet
```kotlin
class UserRoutesTest {
    @Test
    fun `test register user returns 201 created`() = testApplication {
        // Setup mock service via Koin
        val mockService = mockk<UserService>()
        coEvery { mockService.register(any()) } returns UserResponse("123", "test@test.com")
        
        application {
            install(ContentNegotiation) { json() }
            userRoutes(mockService) // Inject mock into route
        }

        val response = client.post("/api/v1/users/register") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"email":"test@test.com","password":"pass"}""")
        }

        assertEquals(HttpStatusCode.Created, response.status)
    }
}
```
