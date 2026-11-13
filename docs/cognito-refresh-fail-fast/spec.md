# Fail fast on rejected Cognito refreshes — Spec

**Track:** Quick   **Product stage:** Introduction
**Status:** Built   **Last updated:** 2026-11-12
**Plane:** NINJA-13

## Problem

A player whose saved login has expired or been revoked sees a blank page for about 6 seconds on any first page load. Since NINJA-12 this includes `/`, because the router restores the session before every route. The time goes on retries. Cognito answers the refresh with `400 NotAuthorizedException: Invalid Refresh Token`, a final answer. `amazon-cognito-identity-js` 6.3.18 retries every error ("For now, all errors are retryable", `es/Client.js:157`) with backoff of 200, 400, 800, 1600 and 3200 ms, making up to 6 requests before giving up. Latest 6.3.22 is unchanged.

## Acceptance criteria

- [x] AC1: When Cognito rejects a refresh with a service error that won't change on retry (e.g. `NotAuthorizedException`, `UserNotFoundException`), exactly one request is made and the caller gets the error immediately. The library still clears the cached tokens on `NotAuthorizedException`.
- [x] AC2: Network failures (`NetworkError`), throttling (`TooManyRequestsException`) and Cognito-side failures (`InternalErrorException`) are still retried with the library's backoff.
- [x] AC3: A successful refresh is unaffected: one request, new session returned and cached.
- [x] AC4: The behaviour is proven against the real library code, with only `fetch` stubbed. A library upgrade that bypasses the hook (renamed method, different retry path) fails the test suite.
- [x] AC5: `amazon-cognito-identity-js` is pinned to the exact installed version (6.3.18), so an upgrade is a deliberate change that runs AC4's tests.
- [x] AC6: Against the real prod Cognito endpoint, a patched `refreshSession` with an invalid refresh token makes one `InitiateAuth` request and fails in under 1 s. Unpatched, it makes 6 requests over about 6 s. After deploy, a browser with a stale login shows one red POST on `/` (manual check, owner: Miguel).

## Non-goals

- Replacing `amazon-cognito-identity-js` with Amplify v6 `aws-amplify/auth`. That would be a larger migration.
- Changing the router guard or how AC9 of the bug sweep restores the session.
- Retry behaviour of calls that already don't retry (`request`, used by sign-up, login and similar).

## Assumptions and open questions

- Assumption: Cognito returns `__type: NotAuthorizedException` with HTTP 400 for an invalid or expired refresh token. Verified empirically against the prod user-pool client on 2026-11-12.
- Assumption: the library's retry loop honours an error's `nonRetryable` property (`es/Client.js:170-186`, 6.3.18). AC4's test proves this; it is not a documented API.

## Plan

Skipping design review: no UI layout change (the fix is in the auth client).

1. Test first: `services/cognitoRetry.test.ts` builds a real `CognitoUserPool` and `CognitoUser`, stubs `fetch`, calls `refreshSession`, and counts requests for a 400 rejection, a network error with fake timers, and a success (AC1–AC4).
2. `services/cognitoRetry.ts`: `failFastOnServiceErrors(pool)` wraps `pool.client.request` and marks errors whose `code` is not in the retryable set (`NetworkError`, `TooManyRequestsException`, `InternalErrorException`) with `nonRetryable = true`.
3. `services/auth.ts` calls it once, right after creating the pool.
4. Pin the dependency to `6.3.18` in `frontend/package.json` and refresh the lockfile from the root (AC5).
5. Run the full suites, typecheck and build, then deploy to prod (after confirmation) and check AC6 with a revoked refresh token.
