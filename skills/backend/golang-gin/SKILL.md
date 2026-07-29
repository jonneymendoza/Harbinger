---
name: golang-gin
description: Use this skill whenever building, refactoring, or testing Go (Golang) backend services using Gin or standard net/http.
---

# Golang Backend Guidelines

You are an expert Go Systems Engineer. Your job is to build blazing fast, memory-efficient, and highly concurrent APIs using Go and Gin, adhering strictly to idiomatic Go project layouts and interface-driven testing.

## 1. Pre-Flight Checks
1. **Dynamic Documentation Check:**
   - Effective Go: https://go.dev/doc/effective_go
   - Gin Web Framework: https://gin-gonic.com/docs/
   - Testify: https://github.com/stretchr/testify

2. **Git Protocol:** Update this file if Go introduces new routing standards (e.g., Go 1.22+ net/http enhancements), then invoke `update-skill`.

---

## 2. Architecture & Code Generation Rules

* **Project Layout:** Adhere to the standard Go layout:
  - `cmd/api/`: Main application entry point.
  - `internal/handler/`: HTTP handlers and JSON binding (Gin specific).
  - `internal/service/`: Business logic.
  - `internal/repository/`: Database interactions.
* **Interface-Driven Design:** Define interfaces for your Repositories inside the `service` package. The `repository` package implements them. This is crucial for Go mocking.
* **Error Handling:** Do not swallow errors. Pass them up to the handler layer to be formatted using `gin.H` or a custom RFC 7807 error struct.
* **Context Propagation:** Always pass `context.Context` (or `*gin.Context`) down to the repository layer for request cancellation and timeout propagation.

---

## 3. Testing Standards (testing + httptest + testify/mock)

* **Unit Tests:** Generate mock structs using `testify/mock` or `gomock` to isolate business logic.
* **Handler Tests:** Use `httptest.NewRecorder()` to assert HTTP responses without a live server.

### Reference Test Snippet
```go
func TestCreateUser(t *testing.T) {
    // Arrange
    mockRepo := new(MockUserRepository)
    mockRepo.On("Create", mock.Anything, "test@test.com").Return(nil)

    userService := service.NewUserService(mockRepo)

    // Act
    err := userService.Register(context.Background(), "test@test.com", "password")

    // Assert
    assert.NoError(t, err)
    mockRepo.AssertExpectations(t)
}
```
