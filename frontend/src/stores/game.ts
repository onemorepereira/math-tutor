import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameSession, MathProblem, ProblemAttempt, Hint, Scorecard, DifficultyLevel, AnswerResult } from '@/types'
import { gameService } from '@/services/game'
import { useLoadingState } from '@/composables/useLoadingState'

export const useGameStore = defineStore('game', () => {
  const currentSession = ref<GameSession | null>(null)
  const currentProblem = ref<MathProblem | null>(null)
  const currentAttempt = ref<ProblemAttempt | null>(null)
  const hintsReceived = ref<Hint[]>([])
  const { isLoading, error, withLoading } = useLoadingState()
  const scorecard = ref<Scorecard | null>(null)

  const problemStartTime = ref<number>(0)
  const hintsUsedCount = ref<number>(0)

  const currentProblemNumber = computed(() => {
    if (!currentSession.value) return 0
    return currentSession.value.currentProblemIndex + 1
  })

  const totalProblems = computed(() => {
    if (!currentSession.value) return 10
    return currentSession.value.problems.length
  })

  const canRequestHint = computed(() => {
    return hintsUsedCount.value < 2
  })

  async function startNewGame(difficulty: DifficultyLevel, problemCount: number = 10, subcategories?: string[]) {
    scorecard.value = null
    return withLoading(async () => {
      const session = await gameService.createGameSession(difficulty, problemCount, subcategories)
      currentSession.value = session
      await loadNextProblem()
      return session
    }, 'Failed to start game')
  }

  async function resumeSession(sessionId: string) {
    scorecard.value = null
    return withLoading(async () => {
      const session = await gameService.getGameSession(sessionId)
      currentSession.value = session
      await loadNextProblem()

      // Restore the current problem's hint count from the server-side record
      // (hint texts are not stored, but the score deduction is)
      if (currentProblem.value) {
        const recorded = session.hintsRequested?.[currentProblem.value.id] ?? 0
        hintsUsedCount.value = Math.min(recorded, 2)
      }

      return session
    }, 'Failed to resume game')
  }

  async function loadNextProblem() {
    if (!currentSession.value) return

    const index = currentSession.value.currentProblemIndex
    if (index >= currentSession.value.problems.length) {
      await endGame()
      return
    }

    currentProblem.value = currentSession.value.problems[index]
    problemStartTime.value = Date.now()
    hintsUsedCount.value = 0
    hintsReceived.value = []

    currentAttempt.value = {
      problemId: currentProblem.value.id,
      problem: currentProblem.value,
      userAnswer: '',
      isCorrect: false,
      hintsUsed: 0,
      timeSpentSeconds: 0,
      pointsEarned: 0,
      startTime: problemStartTime.value
    }
  }

  async function requestHint() {
    const session = currentSession.value
    const problem = currentProblem.value
    if (!problem || !canRequestHint.value || !session) {
      return null
    }

    return withLoading(async () => {
      const hintNumber = (hintsUsedCount.value + 1) as 1 | 2
      const hint = await gameService.requestHint(session.sessionId, problem.id, hintNumber)

      // Ignore responses that arrive after the problem has changed
      if (currentProblem.value === problem) {
        hintsReceived.value.push(hint)
        hintsUsedCount.value++
      }

      return hint
    }, 'Failed to get hint')
  }

  async function submitAnswer(answer: string): Promise<AnswerResult | undefined> {
    const session = currentSession.value
    const problem = currentProblem.value
    const attempt = currentAttempt.value
    if (!problem || !session || !attempt) {
      return
    }

    return withLoading(async () => {
      const timeSpent = Math.floor((Date.now() - problemStartTime.value) / 1000)

      const result = await gameService.submitAnswer(
        session.sessionId,
        problem.id,
        answer,
        hintsUsedCount.value,
        timeSpent
      )

      // Ignore responses that arrive after the session was reset or replaced
      if (currentSession.value === session) {
        currentAttempt.value = {
          ...attempt,
          userAnswer: answer,
          isCorrect: result.isCorrect,
          hintsUsed: hintsUsedCount.value,
          timeSpentSeconds: timeSpent,
          pointsEarned: result.pointsEarned,
          endTime: Date.now()
        }

        session.attempts.push(currentAttempt.value)
        session.currentProblemIndex++
        session.totalScore += result.pointsEarned
        session.totalTimeSeconds += timeSpent
      }

      return result
    }, 'Failed to submit answer')
  }

  async function endGame() {
    const session = currentSession.value
    if (!session) return

    return withLoading(async () => {
      const finalScorecard = await gameService.endGameSession(session.sessionId)

      // Ignore responses that arrive after the session was reset or replaced
      if (currentSession.value === session) {
        scorecard.value = finalScorecard
        session.isCompleted = true
        currentProblem.value = null
      }

      return finalScorecard
    }, 'Failed to end game')
  }

  async function getSolutionExplanation(problemId: string) {
    const session = currentSession.value
    if (!session) return null

    // No withLoading here: explanations have their own loading UI in the view,
    // and the store-wide isLoading gates whole-page loading states
    return gameService.getSolutionExplanation(session.sessionId, problemId)
  }

  function resetGame() {
    currentSession.value = null
    currentProblem.value = null
    currentAttempt.value = null
    hintsReceived.value = []
    scorecard.value = null
    hintsUsedCount.value = 0
    problemStartTime.value = 0
    error.value = null
  }

  return {
    currentSession,
    currentProblem,
    currentAttempt,
    hintsReceived,
    isLoading,
    error,
    scorecard,
    currentProblemNumber,
    totalProblems,
    canRequestHint,
    hintsUsedCount,
    startNewGame,
    resumeSession,
    loadNextProblem,
    requestHint,
    submitAnswer,
    endGame,
    getSolutionExplanation,
    resetGame
  }
})
