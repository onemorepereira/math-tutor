# Game interface review (November 2026)

**Method:** code reading of `frontend/src/views/GameView.vue`, `ScorecardView.vue`, `HomeView.vue`, `stores/game.ts` and `style.css`. The game wasn't rendered: there's no browser tooling or test account this session. The main claims (input mode, hint label, placeholder, progress counter) were checked against the code. Items marked *(inferred)* depend on how phone browsers behave.

**Overall:** The core loop is sound. Enter submits, focus moves to feedback and back, a failed submit keeps the answer, and a game can be resumed. There's no visible timer, which suits young kids. The biggest problems for a child are on phones and at the input: the keyboard can't type some valid answers, accepted formats are never explained, and hint costs and point values are hidden.

## High

| # | Problem as the kid sees it | Evidence | Suggested change | Effort |
|---|---|---|---|---|
| 1 | On a phone, `-`, `/` and space can't be typed for most numeric problems, so `-3`, `3/4` and `1 1/2` can't be entered outside the topic named exactly "Fractions" *(iOS decimal keypad, inferred)* | `GameView.vue:131-136` (`inputmode="decimal"` unless the topic is `Fractions`) | Use `inputmode="text"` everywhere, or add an on-screen row of `-` `/` `.` and space | S–M |
| 2 | No guidance on answer format. Units (`12 cm`), `x = 5` and `1,000` are marked wrong even when the value is right | `GameView.vue:50` placeholder; `backend/src/utils/answerMatcher.ts:21-24` | Show a hint chosen by answer type ("like 3/4, 1 1/2 or 0.75"); have the backend strip units, `x =` and thousands commas | S / M |
| 3 | Hints look free until used, a problem's value is never shown, and two hints can turn a correct answer into "You earned 0 points!" | `GameView.vue:68`, `:36`, `:188`; `submitAnswer.ts:109-110` | Add a "Worth N pts" chip, label the button "Hint (−5 pts)", and use encouraging copy when a correct answer earns 0 | S |
| 4 | A wrong answer only shows "The correct answer was X", with no "why" until the scorecard | `GameView.vue:191-195`; `stores/game.ts:166` | Show "You said A, the answer is B" plus an inline "Show me how" that loads the explanation | M |

## Medium

| # | Problem | Evidence | Suggested change | Effort |
|---|---|---|---|---|
| 5 | Leaving mid-game has no confirmation. Back on Home, no "Continue" is offered when the session is still in memory, so Start Game silently abandons it | `App.vue:5,15`; `HomeView.vue:197` | Offer Continue for any unfinished session in the store; add "Exit game" with a confirmation | S–M |
| 6 | Feedback and hints aren't announced to screen readers | `GameView.vue:32,88` | `role="status"` / `aria-live="polite"` on the feedback card and the hint list | S |
| 7 | Focus is nearly invisible (outline removed; input glow at 10% opacity) | `GameView.vue:436-438`; `style.css:121-125` | A solid 2–3px `:focus-visible` ring | S |
| 8 | Problem text shrinks to 1.1–1.25rem on phones; the red "−5 points" on yellow likely fails AA contrast | `GameView.vue:524,582,383-386` | Keep questions at 1.5rem or larger; darken the penalty colour | S |
| 9 | After a resume, used hints are counted but their text is gone ("0 left", nothing shown) | `stores/game.ts:49-54` | Store the hint text on the server, or say "You already used 2 hints" | S / M |
| 10 | The phone keyboard likely closes after every problem, and focus doesn't return to the input after a hint *(inferred)* | `GameView.vue:40,244-248,159-168` | Focus the input after a hint; keep the input in place (read-only) during feedback | S–M |

## Low

11. No `prefers-reduced-motion` handling for the score pop, the bouncing ninja and confetti (`GameView.vue:325-334`, `GameLoadingOverlay.vue:58`).
12. "Press Enter to continue" is shown on touch devices (`GameView.vue:94`).
13. "Failed to load game" is a dead end, with no Home or retry button (`GameView.vue:98-100`).
14. Feedback for a correct answer is always the same "Correct!", with no streaks or varied praise (`GameView.vue:187`).

## Bugs found along the way

- **The progress counter moves on early.** `session.currentProblemIndex++` runs on submit (`stores/game.ts:139`), so the header reads "Problem 4 of 10" while problem 3's feedback is still on screen (`GameView.vue:10,14`).
- **The scorecard explanation can show the wrong problem or nothing.** A failed load is only logged, leaving the panel empty. If you expand A and then B quickly, A's slower response can show up under B (`ScorecardView.vue`, `toggleExplanation`).
- **Old sessions get stranded.** Starting a new game while one is unfinished leaves the old one incomplete on the server, and the resume finder takes the first unfinished session from the last 24 h, which may not be the newest (`HomeView.vue:197,203-205`) *(partly inferred)*.

## Suggested next batch

Items 1, 3, 6, 7 and the progress-counter bug are each small and together cover the worst problems for kids on phones. Items 2 and 4 are the biggest learning wins, but they need copy and backend decisions. The Product Designer review in ship-it applies to item 4 and to the hint/points chip in item 3.
