import type { GameSession, MathProblem, ProblemAttempt } from '@/types'

export const HINT_COST = 5

export const PRAISE = ['Correct!', 'Nailed it!', 'Great job!', 'You got it!']

/** How to write the answer, chosen by answer type (the grader accepts all of these) */
export function formatTip(problem: MathProblem): string {
  if (problem.answerType === 'text') return 'Tip: a word or short phrase'
  if (problem.topic === 'Fractions') return 'Tip: type it like 3/4 or 1 1/2'
  return 'Tip: just the number, like 12 or -3.5'
}

/** Praise that varies from one correct answer to the next */
export function praiseFor(attemptIndex: number): string {
  return PRAISE[attemptIndex % PRAISE.length]
}

/** Correct answers in a row, counting back from the latest attempt */
export function currentStreak(attempts: ProblemAttempt[]): number {
  let streak = 0
  for (let i = attempts.length - 1; i >= 0 && attempts[i].isCorrect; i--) {
    streak++
  }
  return streak
}

/**
 * The 1-based number of the problem on screen. The store advances
 * currentProblemIndex as soon as an answer is recorded, so while feedback is
 * showing the index already points at the next problem; the problem itself is
 * the reliable reference.
 */
export function displayedProblemNumber(session: GameSession, problem: MathProblem | null): number {
  const position = problem ? session.problems.findIndex((p) => p.id === problem.id) : -1
  const number = position >= 0 ? position + 1 : session.currentProblemIndex + 1
  return Math.min(number, session.problems.length)
}

export function answeredCount(session: GameSession | null): number {
  return session?.attempts.length ?? 0
}

/** Shown on a resumed problem whose hint texts are no longer in memory */
export function hintPenaltyLine(used: number): string {
  const noun = used === 1 ? 'hint' : 'hints'
  return `You already used ${used} ${noun} on this problem (−${used * HINT_COST} pts).`
}
