# Fail fast on rejected Cognito refreshes — Handoff

**What shipped:** A returning player whose saved login has expired no longer waits about 6 seconds on a blank page. A refresh that Cognito rejects now fails on the first request instead of being retried 5 more times. Branch `fix/cognito-refresh-fail-fast`, Plane NINJA-13. Not deployed yet.

## Verification

Frontend: `cd frontend && npx vitest run`, 34/34 passing (was 26). `vue-tsc --noEmit` and the production build are clean. The new tests were run red first: against a no-op stub, both rejection tests hung in the library's retry loop, and the control test counted 6 requests.

- [x] AC1: `cognitoRetry.test.ts` "makes one request when Cognito rejects the refresh token" and "does not retry other final rejections either". Each runs the real library `refreshSession` with `fetch` stubbed and sees exactly 1 call. The first also confirms the library still clears the stored refresh token.
- [x] AC2: "still retries a network failure / throttling / a Cognito-side failure, then succeeds". The library's backoff runs under fake timers; 2 calls, then a valid session.
- [x] AC3: "leaves a successful refresh unchanged". 1 call; the session is valid and keeps the refresh token.
- [x] AC4: The tests drive the real library. "is needed: the unpatched library retries a rejection five more times" proves the hook is what changes the outcome. If an upgrade bypasses the hook, AC1's tests fail. "never breaks sign-in when the library internals change": a missing client falls back to the library's normal retries with a warning, instead of crashing at load.
- [x] AC5: `frontend/package.json` pins `amazon-cognito-identity-js` to `6.3.18` (`npm ls` confirms). The lockfile was refreshed from the root.
- [x] AC6: The real library ran against the prod Cognito endpoint (client `76n36ih7atfttantbmiogjdbfb`) with an invalid refresh token. Patched: `NotAuthorizedException`, 1 request, 251 ms. Unpatched: 6 requests, 7115 ms. The browser check after deploy is still manual (below).

**Security scans:** a secrets grep over the diff found nothing. `npm audit --omit=dev` reports 0 vulnerabilities. No new dependency; the existing one is pinned.

**Exercised live:** the patched refresh path ran against real Cognito (AC6). It was not run in a browser: the Playwright MCP server failed to connect, and there's no test account.

Manual check after deploy: in a browser with a stale login (or after revoking tokens), load `/`. Devtools should show one red `cognito-idp` POST, and the home page should render at once.

**Gate history:**
- Define: self review, 1 pass. AC6 was reworded from a browser check to a run against the real endpoint, because no browser is available.
- Plan: self review, 1 pass.
- Verify: self review, 1 pass. The first full run crashed `auth.test.ts` (its mocked pool has no client), which exposed a real risk; the fix made the hook fall back safely.

**Specialists consulted:** Experience/Frontend (blank-page state on load). Security (auth session path: rejected refresh tokens are still cleared by the library, AC1).

**Decisions and deviations:**
- Hooks the library's internal `pool.client.request` and sets the `nonRetryable` flag its own retry loop checks (`es/Client.js:170-186`, 6.3.18), rather than reimplementing refresh. Latest 6.3.22 has the same retry code (checked on unpkg), so pinning loses nothing.
- Retryable codes: `NetworkError`, `TooManyRequestsException`, `InternalErrorException`. Every other Cognito error code fails fast.

**Follow-ups:**
- In the longer term, migrate to `aws-amplify/auth` v6, which replaces this library.

**Risks to watch:** a library upgrade must keep `cognitoRetry.test.ts` green; the pin makes that a deliberate step.
