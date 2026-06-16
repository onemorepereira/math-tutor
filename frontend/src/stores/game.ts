import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameSession, MathProblem, ProblemAttempt, Hint, Scorecard, DifficultyLevel } from '@/types'
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
    if (!currentProblem.value || !canRequestHint.value || !currentSession.value) {
      return null
    }

    return withLoading(async () => {
      const hintNumber = (hintsUsedCount.value + 1) as 1 | 2
      const hint = await gameService.requestHint(
        currentSession.value!.sessionId,
        currentProblem.value!.id,
        hintNumber
      )

      hintsReceived.value.push(hint)
      hintsUsedCount.value++

      return hint
    }, 'Failed to get hint', { resetError: false })
  }

  async function submitAnswer(answer: string) {
    if (!currentProblem.value || !currentSession.value || !currentAttempt.value) {
      return
    }

    return withLoading(async () => {
      const timeSpent = Math.floor((Date.now() - problemStartTime.value) / 1000)

      const result = await gameService.submitAnswer(
        currentSession.value!.sessionId,
        currentProblem.value!.id,
        answer,
        hintsUsedCount.value,
        timeSpent
      )

      currentAttempt.value = {
        ...currentAttempt.value!,
        userAnswer: answer,
        isCorrect: result.isCorrect,
        hintsUsed: hintsUsedCount.value,
        timeSpentSeconds: timeSpent,
        pointsEarned: result.pointsEarned,
        endTime: Date.now()
      }

      currentSession.value!.attempts.push(currentAttempt.value)
      currentSession.value!.currentProblemIndex++
      currentSession.value!.totalScore += result.pointsEarned
      currentSession.value!.totalTimeSeconds += timeSpent

      return result
    }, 'Failed to submit answer')
  }

  async function endGame() {
    if (!currentSession.value) return

    return withLoading(async () => {
      const finalScorecard = await gameService.endGameSession(currentSession.value!.sessionId)
      scorecard.value = finalScorecard
      currentSession.value!.isCompleted = true
      currentProblem.value = null
      return finalScorecard
    }, 'Failed to end game', { resetError: false })
  }

  async function getSolutionExplanation(problemId: string) {
    if (!currentSession.value) return null

    return withLoading(
      () => gameService.getSolutionExplanation(currentSession.value!.sessionId, problemId),
      'Failed to get explanation',
      { resetError: false }
    )
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
    loadNextProblem,
    requestHint,
    submitAnswer,
    endGame,
    getSolutionExplanation,
    resetGame
  }
})
