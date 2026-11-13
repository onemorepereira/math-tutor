# Game interface improvements — Launch

## Rollout
- **Mechanism:** direct deploy; there's no flag system and the change is fully revertible.
- **Order:** backend first (`make deploy`, grader change only), then the frontend (`cd frontend && make quick-deploy`). Each half works with the other's old version:
  - a new frontend against the old backend loses only the lenient grading;
  - the old frontend against the new backend gains it.
- **Compatibility window:** none needed. No API, schema or stored-data changes.
- **Build note:** prefix commands with `npm_config_registry=https://registry.npmjs.org/` and `AWS_PROFILE=personal`. Confirm the prod target before deploying.

## Rollback
Revert the merge commit and redeploy both halves with the same commands. No data changes need undoing. Attempts already graded leniently stay graded, which is the intended behaviour.

## Observability
- **Metrics:** no product analytics exist.
  - "Show me how" use shows up as `GetSolutionExplanation` Lambda invocations rising while games are still in progress (today they only happen from the scorecard).
  - Lenient grading shows up as a lower wrong-answer rate on numeric problems. It can be re-graded offline from stored attempts.
- **Logs:**
  - `ProblemExplanation` logs `Failed to load explanation:` in the browser console.
  - On the backend, `[verifyProblemAnswers] Dropped …` volume should not *rise* (ADR-6 can only reduce drops).
- **Alerts:** none exist today. Watch the `GetSolutionExplanation` error rate in CloudWatch for the first week; on-demand calls during games mean more Bedrock traffic.

## Communication
- [x] PR description
- [x] Spec, design and handoff in `docs/game-ui-improvements/`
- [ ] CHANGELOG: the repo has none
- [x] User docs: none exist for players; the UI copy is the documentation

## Known limitations
- `inputmode="text"` gives phones the full keyboard. Integer-only problems lose the number pad, which was a deliberate trade-off (ADR-3).
- A resumed problem says how many hints were used but can't show their text (hint text isn't stored server-side).
- Chrome only, under automation: pressing Back within milliseconds of closing the exit dialog with Escape cancels the navigation without reopening the dialog.
- `correctAnswer` is still sent to the browser with the session (a pre-existing issue, follow-up).

## Post-launch checks
Within a day of deploy, on a real phone (iOS Safari and Android Chrome):
1. The answer box opens the full keyboard, and `-3`, `3/4` and `1 1/2` can be typed.
2. A wrong answer → "Show me how" shows steps; Next still works.
3. Exit → dialog → Leave → Home shows Continue → Continue resumes the next problem.
4. "Press Enter to continue" is not shown on the phone.

Roll back if answers can't be typed on a phone (1), or if Continue shows an already-answered problem (3).
