# JSONPlaceholder API Test Framework (Node.js)

CircleCI Status:
[![CircleCI](https://circleci.com/gh/qa-riccardo/jsonplaceholder-api-tests.svg?style=shield)](https://circleci.com/gh/qa-riccardo/jsonplaceholder-api-tests)

API regression/contract tests for a simple blog workflow using the public JSONPlaceholder service.

## What is being tested

Workflow:

1. Search for the user with username `Delphine`.
2. Fetch posts written by that user.
3. For each post, fetch comments.
4. Validate that every comment `email` is in a proper format.

The framework includes:

- Deterministic mock-based scenarios
- Live contract tests against the real API
- Network resilience scenarios (timeouts, retries, 5xx handling)
- Response schema validation

## Tech stack

- **Node.js built-in test runner** (`node --test`) — no heavy framework setup
- **Axios** (HTTP client with retries and timeouts)
- **Zod** (response schema validation)
- **validator.js** (email validation)
- Custom in-test mock HTTP server (no external mocking libraries)

## Project structure

- `src/api/`                            — API client + HTTP wrapper (timeouts, retries)
  - `httpClient.js`                     — Axios wrapper with retry and exponential backoff
  - `jsonPlaceholderApi.js`             — Facade for all JSONPlaceholder endpoints
- `src/schemas/`                        — Zod schemas for contract validation
  - `user.js`, `post.js`, `comment.js`
- `src/utils/`                          — shared utilities
  - `email.js`                          — email format validation
  - `errors.js`                         — custom error classes (ApiError, ValidationError)
  - `env.js`                            — environment variable helpers
- `src/index.js`                        — barrel export (API, schemas, utils)
- `test/`                               — test files
  - `comments-email-validation.spec.js` — main workflow tests (mock + live)
  - `contract.spec.js`                  — contract/schema shape tests (mock + live)
  - `helpers/mockServer.js`             — in-process HTTP mock server (no external deps)
- `scripts/`                            — tooling scripts
  - `run-tests.js`                      — cross-platform test runner
  - `generate-report.js`                — converts JUnit XML to HTML report
  - `fix-junit.js`                      — fixes JUnit XML structure for CircleCI
- `docs/`                               — documentation
  - `test-plan.md`                      — test plan and coverage matrix
  - `defects.md`                        — defect log
- `.circleci/config.yml`                — CI pipeline configuration

## Running the project

### Requirements

- Node.js >= 20
- npm (bundled with Node)

No additional configuration is required.

### Clone the repository

```bash
git clone https://github.com/qa-riccardo/jsonplaceholder-api-tests.git
cd jsonplaceholder-api-tests
```

### Install dependencies

```bash
npm install
```

### Run tests

| Command                   | Description                                                    |
|---------------------------|----------------------------------------------------------------|
| `npm test`                | All deterministic (mock) tests. Live tests skipped.            |
| `npm run test:live`       | All tests including live calls to JSONPlaceholder.             |
| `npm run test:ci`         | Deterministic tests with JUnit XML output for CI reporting.    |
| `npm run test:report`     | Generates JUnit XML and an HTML test report locally.           |
| `npm run test:live:report`| All tests (including live) + JUnit XML + HTML report.          |

After running any `*:report` command, open `test-results/report.html` in your browser to view the HTML test report.

## Test scenarios covered

### `comments-email-validation.spec.js`

| #  | Scenario                                                      | Type  |
|----|---------------------------------------------------------------|-------|
| 1  | Happy path: Delphine -> posts -> comments -> all emails valid | Live  |
| 2  | User not found -> clear ApiError                              | Mock  |
| 3  | Multiple users for same username -> ApiError (ambiguous)      | Mock  |
| 4  | No posts for user -> fail-fast signal                         | Mock  |
| 5  | Invalid email in comments -> detected and reported            | Mock  |
| 6  | 5xx -> retries then succeeds                                  | Mock  |
| 7  | Empty comments for a post -> vacuously valid (no crash)       | Mock  |
| 8  | Malformed user response (missing field) -> ValidationError    | Mock  |
| 9  | Malformed post response (wrong type) -> ValidationError       | Mock  |
| 10 | Malformed comment response (missing email) -> ValidationError | Mock  |
| 11 | 429 rate-limited -> no retry, ApiError with status 429        | Mock  |
| 12 | Network timeout -> retries then ApiError                      | Mock  |

### `contract.spec.js`

| # | Scenario                                                  | Type  |
|---|-----------------------------------------------------------|-------|
| 1 | User shape: all fields present with correct types         | Live  |
| 2 | Post shape: all fields present, userId matches user       | Live  |
| 3 | Comment shape: all fields present, postId matches post    | Live  |
| 4 | Non-array users response -> ValidationError               | Mock  |
| 5 | Non-array posts response -> ValidationError               | Mock  |

## Configuration

The framework is cross-platform and runs with minimal configuration.

Optional environment variables:

| Variable    | Default                                  | Description                                        |
|-------------|------------------------------------------|----------------------------------------------------|
| `BASE_URL`  | `https://jsonplaceholder.typicode.com`   | API base URL                                       |
| `TIMEOUT_MS`| `10000`                                  | Request timeout in milliseconds                    |
| `RETRIES`   | `2`                                      | Number of retries on transient failures            |
| `RUN_LIVE`  | `false`                                  | Set to `true` to enable live tests against real API|

## CI (CircleCI)

Pipeline is in `.circleci/config.yml`. It:

1. Installs dependencies.
2. Runs `npm run test:ci` (deterministic mock tests only — no live network calls).
3. Publishes JUnit XML results to CircleCI's **Tests** tab via `store_test_results`.
4. Stores the XML as a downloadable artifact via `store_artifacts`.

Live tests are intentionally **opt-in** to keep CI reliable even if the public service is temporarily unavailable.
