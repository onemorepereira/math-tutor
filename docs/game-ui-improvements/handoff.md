# Game interface improvements — Handoff

**What shipped:** Every item in the game interface review ([`docs/game-ui-review/review.md`](../game-ui-review/review.md)), built to the design Miguel approved (screens A–H):
- The phone keyboard can type any answer, with a format tip for each answer type.
- Each problem shows its points, and the hint button shows the hint's cost.
- Wrong answers show what the kid typed next to the right answer, plus an inline "Show me how" explanation. Correct answers get varied praise and a streak.
- An exit confirmation, Continue from Home, and a way back Home when the game can't load.
- Screen-reader announcements, visible focus rings, larger text on phones, and reduced motion.
- Fixes for the progress counter and the scorecard explanation bugs.
- On the backend, lenient grading of units, `x =`, `$` and thousands commas.

Branch `feat/game-ui-improvements`, Plane NINJA-14. Not deployed yet.

## Verification

Backend `cd backend && npm test`: 97/97 (88 before). Frontend `cd frontend && npm test`: 76/76 (34 before), run 3 times with no flakes. `tsc --noEmit`, `vue-tsc --noEmit` and both production builds are clean. New tests were run red against the old code: grader 5 failing, HomeView 2/2 failing, style rules 2/5 failing.

**Headless render** of the real app (Vite dev server, headless Chrome via `playwright-core@1.56.1`, at 375 px with touch and at 1280 px). Only the network was faked: Cognito tokens were seeded in localStorage and `/api` calls were answered by the harness. Result: **57/57 checks, 3 consecutive runs**. The harness is in `render-harness.mjs` and the screenshots are in `screenshots/`.

- [x] AC1: `GameView.test` "asks for the full keyboard"; render: `inputmode=text` on phone and desktop.
- [x] AC2: `gameFeedback.test` formatTip; `GameView.test`. Render: the Fractions tip on problem 1, and the text tip on problem 4.
- [x] AC3: `answerMatcher.test` "decorated numeric answers" (8 cases including rejections: `12 m`≠`12 cm`, `3`≠`3x`/`2pi`/`4 i`, `1,5`). `answerVerification.test` (ADR-6).
- [x] AC4, AC5: `GameView.test` "shows what the problem is worth…"; render: "⭐ 10 pts" and "💡 Hint −5 pts · 2 left".
- [x] AC6: `GameView.test` "resumed problem"; render: a server resume with 2 hints shows the line and "0 left" (`phone-B2-resumed-hints.jpg`).
- [x] AC7: `GameView.test` streak, praise and zero points; render: "Nailed it!", "🔥 2" in the header and "· 🔥 2 in a row" (`phone-C-correct-streak.jpg`).
- [x] AC8: `ProblemExplanation.test` (loading, loaded, focus, retry, stale response, propagation) and `GameView.test` (echo plus Show me how). Render: echo, inline steps, and the error state with focus on Try again (`phone-D*.jpg`).
- [x] AC9: `gameFeedback.test` and `GameView.test`; render: "Problem 1 of 4" while that problem's feedback is showing.
- [x] AC10:
  - `LeaveGameDialog.test` (6 tests, including Escape and the confirm fallback) and `GameView.test` (Exit and Keep playing, Leave with `replace`, no prompt for scorecard, login or reset).
  - Render:
    - Exit → the dialog is centred with Keep playing focused.
    - Escape stays in the game.
    - **Browser Back opens the dialog.**
    - Leave → Home.
- [x] AC11: `HomeView.test` (in-memory Continue without a fetch; a completed in-memory session falls back to the server) and `GameView.test` "continue after feedback". Render: Leave during feedback → Continue → "Problem 4 of 4".
- [x] AC12: `GameView.test` "offers a way home". Not rendered, because the state can't be reached through the UI with a healthy fake API.
- [x] AC13: `ProblemExplanation.test` "stale response" and "Try again". The scorecard now uses that component.
- [x] AC14: `GameView.test` checks that the same always-mounted announcer carries the result, and that Enter on Show me how doesn't advance. Render: the announcer text for the hint and the correct answer; Enter on Show me how keeps the card.
- [x] AC15: `styles.test.ts`; render: computed `solid 3px rgb(76, 81, 191)` on keyboard focus.
- [x] AC16: `styles.test.ts` (rules, plus contrast 6.65:1 computed in the test); render: question at 24 px on the phone, penalty `rgb(167, 29, 42)`.
- [x] AC17: `styles.test.ts`; render with emulated reduced motion: button transition `1e-05s`.
- [x] AC18: `styles.test.ts`; render: hidden with a coarse pointer (`display: none`), shown with a mouse.
- [x] AC19: everything above. Main chunk +298 B gzip against the bundle currently on prod (budget 5 KB).

**Exercised live:** the real frontend in headless Chrome, as above. Prod was not touched.

**Not exercised:**
- Real iOS and Android keyboards. `inputmode` is only a hint, so see the post-launch checks in `launch.md`.
- A real screen reader. The live region is verified structurally, not by listening.

**Security scans:**
- A secrets grep over the diff was clean.
- `npm audit --omit=dev`: 0.
- Dev-only: 4 new moderate advisories (glob and minimatch via `js-beautify` → `@vue/test-utils`) with no non-breaking fix. Accepted: they only run on this repo's own test files and need attacker-controlled glob patterns. Pinning `@vue/test-utils` 2.4.11 instead of 2.5.1 avoided the larger `js-beautify` 2 chain.
- Echoed answers and explanations render as escaped text (no `v-html`).

## Gate history
- Discover: problem statement agreed with the user. Design review: round 1 had four choices; round 2 was the refined A–H, **approved** by Miguel.
- Define: self review, 1 pass, no blockers.
- Design: subagent, **3 passes**.
  - Pass 1: 7 blockers, all fixed.
    - grader units → allowlist + matching units
    - Enter bubbling → `.self`
    - live region → always-mounted announcer
    - Continue after feedback → skip the answered problem
    - guard allow-list
    - jsdom dialog stubbing
    - per-file jsdom
  - Pass 2: 5 blockers, all fixed.
    - stale plan text (×2)
    - the `answerVerification` caller → ADR-6
    - parse order
    - push vs replace
  - Pass 3: no design blockers. Two document blockers: a plan section that didn't stand alone, and an unspecified `null` explanation result. **I resolved both without a 4th pass.** The plan section was rewritten to stand alone, and `null` counts as an error (already implemented). No finding changed the approved design.
- Plan: self review, 1 pass.
- Verify: the headless render found a real bug (the dialog pinned top-left by the global margin reset), fixed in `dc525fc`. Two harness artifacts were diagnosed rather than papered over:
  - The touch emulation was dropped after a full-page screenshot.
  - The 0.3 s `.btn` transition delays the focus ring colour.
- Verify gate: see the PR (subagent review).
- Launch: self review, 1 pass.

## Specialists consulted
Experience (Product Designer: two-round review and approval; Frontend: all states rendered at both widths; Accessibility: keyboard flow, focus, contrast, live region). Quality (tests at the cheapest level through real wiring, red-first, 3× flake check, exploratory: Escape, Back, Leave mid-feedback, failing explanation).

## Decisions and deviations
- Scope "everything", wrong answers "Echo + Show me how", the card layout "chips + labelled hint" and grading "strip": all chosen by Miguel.
- Stricter than first described to the user: units must **match** when both sides have one, and only allowlisted units are stripped (so `3` is never accepted for `3x`).
- ADR-6: answer verification at generation time shares the lenient matcher. This only reduces false "disagreement" drops (a generated `12 cm` vs a verified `12`). Mismatched units and variables still drop.
- `@vue/test-utils` pinned at 2.4.11 rather than the latest 2.5.1 (advisories, above). `jsdom` pinned at 30.1.3 rather than 31 (a week old).
- `restartProblemClock` (new store action): returning to a problem no longer counts the time spent away.
- See also "Build notes (deviations)" in `design.md`.

## Follow-ups
- Stop sending `correctAnswer` to the browser with the session (any kid can read the answers in devtools).
- Store hint text server-side so a resumed problem can show it.
- Real-device keyboard check, and an on-screen symbol row if a platform's text keyboard proves awkward.
- Commit a browser harness to CI once the repo has CI (today `render-harness.mjs` is documentation).
- Nested interactive content inside the scorecard's `role="button"` row is an accessibility smell; consider a disclosure button instead.

## Risks to watch
- More Bedrock calls from in-game "Show me how". Watch the `GetSolutionExplanation` errors and latency.
- If a kid's correct-looking answer is still marked wrong, check whether its unit is on the allowlist.
