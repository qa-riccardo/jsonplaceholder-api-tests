# Test Plan & Coverage

## Scope

Validate the email format of all comments belonging to posts authored by a specific user.

**Target user:** `Delphine`

**Endpoints under test:**

| Method | Endpoint                   | Purpose                 |
|--------|-----------------------------|-------------------------|
| `GET`  | `/users?username=Delphine` | Resolve user identity   |
| `GET`  | `/posts?userId=<id>`       | Fetch user's posts      |
| `GET`  | `/comments?postId=<id>`    | Fetch comments per post |

---

## Validation Rules

### Contract Validation (Schema)

Responses must be JSON arrays. Each element must include the following fields with correct types:

**User** — fields required by this workflow:

| Field      | Type    | Note     |
|------------|---------|----------|
| `id`       | integer | positive |
| `name`     | string  |          |
| `username` | string  |          |
| `email`    | string  |          |

> The `/users` endpoint returns additional fields (`address`, `phone`, `website`, `company`) which are not required by this workflow and are intentionally excluded from schema validation.

**Post:**

| Field    | Type    |
|----------|---------|
| `userId` | integer |
| `id`     | integer |
| `title`  | string  |
| `body`   | string  |

**Comment:**

| Field    | Type    |
|----------|---------|
| `postId` | integer |
| `id`     | integer |
| `name`   | string  |
| `email`  | string  |
| `body`   | string  |

**Relational integrity:**

- Each post's `userId` must match the queried user's `id`.
- Each comment's `postId` must match the queried post's `id`.

### Email Format Validation

For each comment, `email` is validated using `validator.js` `isEmail()`.

---

## Test Scenarios

### Happy Path

| Scenario                                                 | Status     | Test file                                  |
|----------------------------------------------------------|------------|--------------------------------------------|
| User found uniquely, has posts, all comment emails valid | ✅ Covered | `comments-email-validation.spec.js` (live) |

### Failure & Edge Cases

| #  | Scenario                                             | Expected behaviour                         | Status     | Test file                           |
|----|------------------------------------------------------|--------------------------------------------|------------|-------------------------------------|
| 1  | **User not found** — empty array returned            | `ApiError` "User not found"                | ✅ Covered | `comments-email-validation.spec.js` |
| 2  | **Multiple users** matched by username               | `ApiError` "Multiple users"                | ✅ Covered | `comments-email-validation.spec.js` |
| 3  | **Posts list empty** — valid user, no posts          | Fail-fast `ApiError`                       | ✅ Covered | `comments-email-validation.spec.js` |
| 4  | **Comments list empty** — post has no comments       | Pass (vacuously valid, no crash)           | ✅ Covered | `comments-email-validation.spec.js` |
| 5  | **Invalid email in comments**                        | Detect and report all invalid values       | ✅ Covered | `comments-email-validation.spec.js` |
| 6  | **Malformed user response** — missing required field | `ValidationError` with schema details      | ✅ Covered | `comments-email-validation.spec.js` |
| 7  | **Malformed post response** — wrong field type       | `ValidationError` with schema details      | ✅ Covered | `comments-email-validation.spec.js` |
| 8  | **Malformed comment response** — missing email field | `ValidationError` with schema details      | ✅ Covered | `comments-email-validation.spec.js` |
| 9  | **Non-array response** for users or posts            | `ValidationError`                          | ✅ Covered | `contract.spec.js` (x2)             |
| 10 | **Service returns 5xx**                              | Retry up to 3x, then succeed or `ApiError` | ✅ Covered | `comments-email-validation.spec.js` |
| 11 | **Timeout / network failure**                        | Retry up to 3x, then `ApiError`            | ✅ Covered | `comments-email-validation.spec.js` |
| 12 | **Rate limiting (429)**                              | No retry, `ApiError` with status 429       | ✅ Covered | `comments-email-validation.spec.js` |

### Contract Shape Checks (Live)

| Scenario                                              | Status     | Test file          |
|-------------------------------------------------------|------------|--------------------|
| User fields — correct types and values                | ✅ Covered | `contract.spec.js` |
| Post fields — correct types, `userId` matches user    | ✅ Covered | `contract.spec.js` |
| Comment fields — correct types, `postId` matches post | ✅ Covered | `contract.spec.js` |

---

## Non-Functional Notes

- Retries with exponential backoff reduce flakiness on transient 5xx errors.
- HTTP 429 is treated as non-retryable (client-side rate limit error).
- All negative tests use an in-process mock server — no external dependencies, fully deterministic.
- CI runs mock-only tests (`npm run test:ci`); live tests are opt-in via `RUN_LIVE=true`.
- JUnit XML report is published to the CircleCI Tests tab on every pipeline run.
