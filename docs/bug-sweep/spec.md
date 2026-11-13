# Bug sweep (November 2026) — Spec

**Track:** Quick   **Product stage:** Introduction
**Status:** Built   **Last updated:** 2026-11-12
**Plane:** NINJA-12

## Problem

Players can be graded wrong or hit errors mid-game. Three causes: the model returns an answer as a JSON number, an answer contains spaces between digits, or two requests race. Public stats and per-player history silently undercount once the tables pass DynamoDB's 1 MB page size. In the browser, a reload makes a logged-in player look logged out, and a failed submit offers a "Next Problem" button that replays the same problem.

## Acceptance criteria

**Grading and generation (backend)**
- [x] AC1: Given a stored `correctAnswer` that is a JSON number (e.g. `42`), when a player submits a wrong answer, then it is graded incorrect (no exception). Answer verification also completes instead of falling back to "keep all unverified".
- [x] AC2: Given correct answer `42`, `4 2` is graded incorrect. Given correct answer `3/2`, `1 1/2` is graded correct; given `11/2`, `1 1/2` is graded incorrect. Existing equivalences (`2/4`≈`1/2`, `0.375`≈`3/8`, `25%`≈`25`, text answers ignoring case and spacing) still pass.
- [x] AC3: Given model output with a missing or non-string `question`/`correctAnswer`, that item is dropped. A non-numeric or out-of-range `maxPoints` is clamped to an integer in 5–20. A missing `topic` gets a default. Session creation never fails on one malformed item.
- [x] AC4: `problemCount` above 20 is rejected with 400 (the UI offers 5/10/15/20).

**Data integrity (backend)**
- [x] AC5: The leaderboard and activity-cache refresh, and `getUserSessions`, follow `LastEvaluatedKey` until every page is read.
- [x] AC6: A cache entry outlives at least two refresh periods, so a late or failed refresh serves the last good data instead of `[]`.
- [x] AC7: Two hint requests on different problems of the same session both persist. A hint request against a completed session is refused by the write condition, not just the pre-read.
- [x] AC8: `endGameSession` marks the session complete and credits the user in one transaction, conditioned on the attempt count it read. The credited score always equals the scorecard it returns. A retry after any failure neither double-credits nor loses the credit.

**Frontend**
- [x] AC9: Given a valid Cognito session, a hard reload on any route, including `/`, `/login` and `/register`, restores the logged-in state before the route renders.
- [x] AC10: Logging out clears the game store, so the next user sees no previous scorecard or session.
- [x] AC11: When a submit fails, the answer form stays visible with an inline error and the typed answer is kept. A 409 resyncs the session from the server. No "Next Problem" button replays the problem.
- [x] AC12: When the token can't be refreshed, API calls don't send `Bearer null`. The user is logged out and sent to `/login`.
- [x] AC13: Returning Home after a game shows the updated belt and total score. A newly registered user's profile includes `totalScore` and `gamesPlayed`.
- [x] AC14: The personal activity heatmap and its tooltips key days by the player's local calendar date, in UTC+ and UTC- zones alike. The platform activity calendar, which only has server totals bucketed by UTC day, labels each cell with that same UTC day, so a cell's label and its count always refer to the same day.

**Dependencies**
- [x] AC15: `npm audit --omit=dev` reports no high or critical advisories that a non-breaking update can fix. The unused root dependency `knit` is removed. Builds and all tests pass.

## Non-goals

- No schema changes or data backfill. Old sessions without `hintsRequested` keep working.
- No deploy as part of this change. Deploying to prod is a separate, confirmed step.
- The Makefile ignoring `ENV`, and stale docs, belong to NINJA-11.
- No API Gateway `GatewayResponses` CORS block (follow-up), and no change to the leaderboard/activity Scan design beyond pagination.

## Assumptions and open questions

- Assumption: the activity cache keys days by the UTC date of `endTime`, and the frontend renders local dates. Keying by UTC server-side stays; this spec fixes only the client's local-date mismatch (`toISOString` on local midnight). Owner: Miguel. Default: accept a ±1-day edge for games played near midnight UTC.
- Assumption: prod CloudWatch logs weren't readable (access was denied in this session), so how often AC1 occurs in prod is unknown. The fix doesn't depend on it.

## Plan

1. Answer matcher: coerce inputs to strings, keep a space between digit groups, parse mixed numbers; add tests (AC1, AC2).
2. Generation: a `sanitizeGeneratedProblems` helper, called from `createGameSession`; cap problemCount at 20 (AC3, AC4).
3. Pagination loops in `updatePublicStatsCache` and `getUserSessions`; cache TTL = 1 h (AC5, AC6).
4. `requestHint`: initialize the map, then a per-key conditional SET (AC7). `endGameSession`: a `TransactWriteCommand` (AC8).
5. Frontend: run the auth check once in the router guard; reset the game on logout; inline submit error plus 409 resync; refresh the profile on Home; null-token handling; local date keys; register response fields (AC9–AC14).
6. `npm audit fix` from the root; remove `knit` (AC15).
7. Full backend and frontend test suites, typechecks, builds, and a local run of the frontend.
