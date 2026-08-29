import { checkAnswerCorrect } from './answerMatcher.js'

export interface VerifiableProblem {
  id: string
  question: string
  correctAnswer: string
  answerType: string
}

/**
 * Compares each generated answer against an independent solve of the same
 * question and drops the problems where the two disagree.
 *
 * Generation runs at a high temperature and can hallucinate an answer (a kid
 * being told their correct answer is wrong is the worst outcome here), so a
 * disagreement means neither answer is trustworthy — the problem is dropped
 * rather than "corrected". Problems the verifier did not answer are kept, so a
 * partial verification response degrades gracefully instead of emptying a game.
 */
export function reconcileVerifiedAnswers<T extends VerifiableProblem>(
  problems: T[],
  verifiedAnswers: Record<string, string>
): { problems: T[]; droppedIds: string[] } {
  const droppedIds: string[] = []

  const kept = problems.filter((problem) => {
    const verified = verifiedAnswers[problem.id]
    if (verified === undefined || verified === null || String(verified).trim() === '') {
      return true
    }

    if (checkAnswerCorrect(String(verified), problem.correctAnswer)) {
      return true
    }

    droppedIds.push(problem.id)
    return false
  })

  return { problems: kept, droppedIds }
}
