# Bug sweep (November 2026) — Handoff

**What shipped:** Fixes for 13 confirmed bugs across grading, model-output handling, data integrity, auth state and dates, plus the non-breaking dependency security updates. Branch `fix/bug-sweep`, Plane NINJA-12. Nothing is deployed yet.

## Verification

Backend: `cd backend && npm test`, 88/88 passing (69 before this change; the new tests were run red-then-green). Frontend: `cd frontend && npx vitest run`, 26/26 (13 before). `tsc --noEmit`, `vue-tsc --noEmit`, the backend build and the frontend production build are all clean.

- [x] AC1: numeric `correctAnswer` grades instead of throwing. Proven by `answerMatcher.test.ts` "non-string answers from the model", by `answerVerification.test.ts` "reconciles problems whose generated answer is a JSON number", and by the live check (wrong answer `41` against stored number `42` returned 200 `isCorrect:false`; `main` returned 500).
- [x] AC2: `4 2`≠`42`; `1 1/2`=`3/2`. Proven by `answerMatcher.test.ts` "spaces between digits" and the live check (`main` accepted `4 2` for `42` and awarded 20 points).
- [x] AC3: malformed model output. Proven by `problemSanitizer.test.ts` and the live check (5 messy items gave 3 problems with points `20,10,5`, answers stringified; `main` returned 500).
- [x] AC4: count capped at 20. Proven by `validation.test.ts` and the live check (21 → 400).
- [x] AC5: pagination. Proven by `getUserSessions.test.ts` "reads every page", `updatePublicStatsCache.test.ts`, and the live check. 60 sessions of about 30 KB gave a first page of 35; the branch counted 60 and 61, while `main` counted 35 and 36.
- [x] AC6: TTL is 1 h. Proven by `updatePublicStatsCache.test.ts` and the live check (3600 s; `main` 900 s).
- [x] AC7: per-key, conditional hint write. Proven by `requestHint.test.ts` and the live check (3 concurrent hints all recorded, where `main` kept 1 of 3; a lower hint doesn't overwrite a higher one; a hint after completion → 409).
- [x] AC8: transactional end. Proven by `endGameSession.test.ts`, including "credits the score of the latest attempts when an answer lands mid-completion", and the live check (two concurrent ends credit exactly once and the score matches the scorecard).
- [x] AC9: `stores/auth.test.ts` "restores a stored Cognito session once"; the router guard now awaits `ensureAuthChecked()` on every route.
- [x] AC10: `stores/auth.test.ts` "logging out clears the previous player's game".
- [x] AC11: verified by `vue-tsc`, the build and the Vite dev compile only. **Not rendered or clicked** (see Exercised live).
- [x] AC12: `services/game.test.ts` "an unrefreshable session never sends Bearer null"; the handler is wired in `main.ts`.
- [x] AC13: `register.test.ts` "returns the score fields…" and `stores/auth.test.ts` "refreshUser…"; HomeView calls `refreshUser()` on mount.
- [x] AC14: `utils/dates.test.ts` in America/Chicago, Africa/Cairo and Asia/Tokyo. The old code was shown to key a Cairo local midnight as the previous day.
- [x] AC15: `npm audit --omit=dev` reports 0 vulnerabilities (was 7, 5 of them high). 7 low remain in dev-only tooling (`deepmerge` chain) and need breaking upgrades.

**Exercised live:** The compiled Lambda handlers ran in-process against DynamoDB Local 3.3.1 (podman, in-memory, tables matching `template.yaml`) and an HTTP/2 Bedrock stub. The branch passed 20/20 checks. The same script against a build of `main` passed 7/17, which proves the checks detect the original bugs. This exercised the real DynamoDB expressions: the nested-map SET with its condition, `if_not_exists` initialization on old sessions, the `TransactWriteItems` condition `size(attempts)`, and the paginators across a real 1 MB page boundary.

**Not exercised live:**
- The frontend in a browser. The Playwright MCP server failed to connect, and there's no Cognito test account. The changed modules were compiled through the Vite dev server (all 200).
- Prod. CloudWatch log reads were denied in this session, so how often AC1 occurs in prod is unknown.

Manual checks after deploy:
1. Log in, then hard-reload `/`. You should still see the dashboard, not the hero.
2. Finish a game and go Home. The belt and points should reflect that game.
3. With devtools set to Offline, submit an answer. The form should stay, with "Your answer could not be sent", and come back online to retry.
4. Log out, then log in as another user. There should be no previous scorecard.

**Gate history:**
- Define: self review, 1 pass. No blockers.
- Plan: self review, 1 pass.
- Verify: self review, 1 pass. AC14's wording was corrected to match the platform calendar's UTC labelling (drift caught at Verify), and the duplicate toast-plus-inline message was fixed.

**Specialists consulted:**
- Data: pagination, conditional writes and the transaction. Grounded in the AWS Scan API reference (1 MB page, filter applied after the read), the update-expressions guide (a nested SET needs the parent map) and the transactions IAM guide (`UpdateItem` covers transactional `Update`, so no template change).
- AI/ML: model output is validated (`problemSanitizer.ts`).
- Experience/Frontend: auth and error states.

**Decisions and deviations:**
- The platform calendar labels UTC days rather than local ones, because its server totals are UTC-bucketed. The personal heatmap now buckets sessions client-side by local day and no longer uses the server's UTC-keyed `dailyActivity`.
- `endGameSession` re-reads and retries up to 3 times when the transaction is cancelled, then returns 409.
- Hint writes treat a failed condition as success: a higher hint is already recorded, or the session is completed, and either way the score is settled.

**Follow-ups:**
- The Makefile ignores `ENV` (deploys `samconfig.toml`'s prod stack). This belongs to NINJA-11.
- Add a `GatewayResponses` CORS block so gateway-generated 401/403/429 responses are readable by the browser.
- `backend/` has no lockfile, so the SAM Makefile's `npm install --production` resolves fresh versions within the declared ranges on every build.
- The server's `dailyActivity` field is now unused by the frontend.
- Dev-only low-severity advisories (`deepmerge`) need breaking upgrades.
- Add component-test tooling (`@vue/test-utils`) so view-level states like AC11 can be tested.

**Risks to watch:**
- After deploy, watch for `TransactionCanceledException` or 409s on `/end` in the EndGameSession logs.
- Watch for `[verifyProblemAnswers] Dropped …` volume. Verification no longer silently skips batches, so more mismatched problems may now be dropped. That is intended.
