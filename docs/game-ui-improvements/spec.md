# Game interface improvements — Spec

**Track:** Standard   **Product stage:** Introduction
**Status:** Built   **Last updated:** 2026-11-12
**Plane:** NINJA-14   **Source:** [`docs/game-ui-review/review.md`](../game-ui-review/review.md)

## Problem

Kids playing on phones can't type some valid answers. Nothing tells them which answer formats count or what a hint costs. A wrong answer gets one line with no help. Keyboard and screen-reader players can't follow what happened. Leaving a game, a failed load and a resumed problem each strand the player without a clear way forward.

## Users

Kids aged 6–18 (elementary 6–10, middle 11–14, high 15–18), often on phones or tablets, many of them early readers. Secondary: kids who use a keyboard or a screen reader.

## Goals

- Every answer the grader accepts can be typed on a phone keyboard.
- Before acting, a kid knows what a problem is worth, what a hint costs and how to write the answer.
- A wrong answer is a chance to learn, inside the game.
- Every game state is announced, reachable by keyboard, and offers a way forward.

## Non-goals

- Hiding `correctAnswer` from the client. The full session is sent to the browser today; that's a separate security follow-up.
- Storing hint text server-side. A resumed problem says how many hints were used instead (review item 9, message option).
- An on-screen symbol keypad. The full phone keyboard covers `-`, `/` and space.
- Changing the scoring rules, problem generation or the scorecard layout.
- A confirmation before Logout. Logout keeps the game on the server, and Home offers to continue it.

## User stories

- As a kid on a phone, I want to type `-3`, `3/4` or `1 1/2` so that my right answer counts.
- As a kid, I want to see what a problem is worth and what a hint costs so that I can decide whether to use one.
- As a kid who got it wrong, I want to see my answer next to the right one and, if I like, how to solve it.
- As a kid who taps away mid-game, I want to be asked first, and then be able to pick up where I left off.
- As a screen-reader user, I want results and hints read out to me.

## Acceptance criteria

**Answering**
- [x] AC1: Given any problem, the answer input uses `inputmode="text"` with autocapitalize, autocorrect and spellcheck off, so `-`, `/`, `.` and space can be typed on a phone keyboard.
- [x] AC2: Below the input, a tip shows for the answer type. Topic `Fractions`: "Tip: type it like 3/4 or 1 1/2". Other numeric: "Tip: just the number, like 12 or -3.5". Text: "Tip: a word or short phrase".
- [x] AC3: Given a numeric correct answer, the grader also accepts the same value written with a leading single-letter `x =` (`x = 5`), thousands commas (`1,000`, `12,345.5`), a leading `$`, or a trailing unit from a fixed allowlist of length, mass, volume, time and angle units, including `square`/`cubic`/`²`/`³` forms (`12 cm`, `45°`, `6 square feet`). The same stripping applies to a stored correct answer that carries units. When both sides carry units, they must match (`12 m` is wrong for `12 cm`). Variables and constants are never stripped: `3` is wrong for `3x`, `2pi` or `4 i`. A one-letter unit (`m`, `g`, `h`, `s`, `l`) only counts as a unit when there's a space before it, so `3` is wrong for the algebra answer `3m` but right for `3 m`. `1,5` is not read as a number. Text answers and existing equivalences are unchanged.

**Points and hints**
- [x] AC4: The problem card shows a points chip, "⭐ N pts", from the problem's `maxPoints`.
- [x] AC5: The hint button reads "💡 Hint −5 pts · K left", with K = 2 minus the hints used.
- [x] AC6: Given a resumed problem whose recorded hints have no text in memory, the card says "You already used N hint(s) on this problem (−5N pts)".

**Feedback**
- [x] AC7: After a correct answer, the card shows one of "Correct!", "Nailed it!", "Great job!" and "You got it!" (rotating by attempt), then "+N points". With 2 or more correct in a row it adds "🔥 S in a row", and the header shows 🔥 S. A correct answer that earned 0 says "Correct! The hints used up this one's points, but you solved it 💪".
- [x] AC8: After a wrong answer, the card shows "You said {typed answer}" and "Answer {correct answer}", plus a "💡 Show me how" button. Pressing it loads the explanation for that problem inline: a loading line, then the explanation text and numbered steps. On failure it says "Couldn't load the explanation." with a Try again button. A response arriving after the player has moved on is ignored.
- [x] AC9: While a problem's feedback is showing, the header reads "Problem N of T" for that same problem, and the progress bar reflects answered problems.

**Leaving, resuming, failing**
- [x] AC10: Given an unfinished game, an "✕ Exit" button in the game header, the header logo, or browser back opens a modal dialog: "Leave this game?" / "Your progress is saved. You can continue it from Home." with "Keep playing" (focused by default, closes the dialog) and "Leave" (completes the navigation). Moving on to the scorecard, or leaving after the game has ended or been reset (logout), is not intercepted.
- [x] AC11: Given an unfinished game in memory, Home shows the "Continue your game" card for it, and Continue returns to the game without a reload. If the kid left while a problem's feedback was showing, Continue shows the next problem (or the scorecard after the last one), never the already-answered problem.
- [x] AC12: When the game can't be shown (no problem loaded and not loading), the page says "We couldn't load your game." with a Back to Home button.
- [x] AC13: On the scorecard, a failed explanation shows "Couldn't load the explanation." with Try again, and quickly opening problem A then B never shows A's explanation under B.

**Accessibility and comfort**
- [x] AC14: An always-present polite live region (`role="status"`) announces each result ("Nailed it! +10 points", "Not quite right. The answer is 3/4") and each hint ("Hint 1: …"), and clears on the next problem. Enter on the "Show me how" or "Try again" button never skips to the next problem.
- [x] AC15: Focusable game controls (input, buttons, feedback card, dialog buttons) show a solid outline of at least 3 px on `:focus-visible`.
- [x] AC16: At phone widths (≤768 px and ≤380 px) the question is at least 1.5rem. The hint penalty text meets WCAG AA contrast (≥4.5:1) on its background.
- [x] AC17: With `prefers-reduced-motion: reduce`, animations and transitions in the app (score pop, loading bounce and spin, confetti, button lifts) are effectively off.
- [x] AC18: "Press Enter to continue" is hidden on devices without a fine pointer (`(hover: none) and (pointer: coarse)`).

**Quality**
- [x] AC19: All existing backend and frontend tests still pass; typecheck and build are clean. New logic has unit tests. Each AC above is proven by an automated test or by a recorded render of the real app in headless Chrome with only the network faked.

## Success signals

- Fewer wrong answers whose value matches the correct answer once units, commas or `x =` are stripped. Measurable later by re-grading stored attempts; no metric pipeline exists today.
- "Show me how" is used. No analytics today; to be checked through explanation Lambda invocations in CloudWatch once log access is available.

## Constraints

- No new runtime dependencies. Dev dependencies for component tests are allowed, pinned to exact versions.
- The explanation endpoint is unchanged: it already serves a problem as soon as an attempt is recorded (`getSolutionExplanation.ts:57-61`).
- `<dialog>`, `:focus-visible`, `inputmode` and `prefers-reduced-motion` must work in current Safari, Chrome and Firefox.

## Assumptions and open questions

- Assumption: iOS and Android show the full keyboard, including `-`, `/` and space, for `inputmode="text"`. If wrong, an on-screen keypad becomes the follow-up. Owner: Miguel (device check after deploy).
- Assumption: answers like `1,000` mean one thousand, never the decimal 1.0. The ≥3-digit comma groups protect `1,5`.
- Open: none. Scope, wrong-answer flow, card layout and lenient grading were decided by Miguel on 2026-11-12, and the design was approved.
