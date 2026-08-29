import { beforeEach, expect, test, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { GameSession, MathProblem, ProblemAttempt } from '@/types'

vi.mock('@/services/game', () => ({
  gameService: {
    createGameSession: vi.fn(),
    requestHint: vi.fn(),
    submitAnswer: vi.fn(),
    endGameSession: vi.fn(),
    getSolutionExplanation: vi.fn(),
    getGameSession: vi.fn()
  }
}))

import { gameService } from '@/services/game'
import { useGameStore } from '@/stores/game'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

function makeProblem(id: string): MathProblem {
  return {
    id,
    question: `Problem ${id}`,
    correctAnswer: '42',
    difficulty: 'elementary',
    topic: 'Multiplication',
    maxPoints: 20,
    answerType: 'numeric'
  } as MathProblem
}

function makeSession(id: string): GameSession {
  return {
    sessionId: id,
    userId: 'user-1',
    startTime: new Date().toISOString(),
    difficulty: 'elementary',
    problems: [makeProblem(`${id}-p1`), makeProblem(`${id}-p2`)],
    attempts: [],
    currentProblemIndex: 0,
    totalScore: 0,
    totalTimeSeconds: 0,
    isCompleted: false
  } as unknown as GameSession
}

function makeAttempt(problem: MathProblem): ProblemAttempt {
  return {
    problemId: problem.id,
    problem,
    userAnswer: '',
    isCorrect: false,
    hintsUsed: 0,
    timeSpentSeconds: 0,
    pointsEarned: 0,
    startTime: Date.now()
  } as ProblemAttempt
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

test('a submit that resolves after the session was replaced does not touch the new session', async () => {
  const store = useGameStore()
  const sessionA = makeSession('a')
  const sessionB = makeSession('b')
  store.currentSession = sessionA
  store.currentProblem = sessionA.problems[0]
  store.currentAttempt = makeAttempt(sessionA.problems[0])

  const pending = deferred<{ isCorrect: boolean; pointsEarned: number; correctAnswer: string }>()
  vi.mocked(gameService.submitAnswer).mockReturnValue(pending.promise)

  const submission = store.submitAnswer('42')

  // User abandons the game and starts a fresh one while the submit is in flight
  store.resetGame()
  store.currentSession = sessionB
  store.currentProblem = sessionB.problems[0]

  pending.resolve({ isCorrect: true, pointsEarned: 20, correctAnswer: '42' })
  await submission

  expect(store.currentSession?.attempts).toHaveLength(0)
  expect(store.currentSession?.totalScore).toBe(0)
  expect(store.currentSession?.currentProblemIndex).toBe(0)
})

test('an endGame that resolves after a new game started does not complete the new session', async () => {
  const store = useGameStore()
  const sessionA = makeSession('a')
  const sessionB = makeSession('b')
  store.currentSession = sessionA

  const pending = deferred<never>()
  vi.mocked(gameService.endGameSession).mockReturnValue(pending.promise as Promise<never>)

  const ending = store.endGame()

  store.resetGame()
  store.currentSession = sessionB
  store.currentProblem = sessionB.problems[0]

  pending.resolve({
    sessionId: 'a',
    totalScore: 15,
    maxPossibleScore: 40,
    totalTimeSeconds: 30,
    correctAnswers: 1,
    incorrectAnswers: 1,
    hintsUsed: 0,
    attempts: []
  } as never)
  await ending

  expect(store.currentSession?.isCompleted).toBe(false)
  expect(store.currentProblem).not.toBeNull()
  expect(store.scorecard).toBeNull()
})

test('a hint that resolves after moving on is not counted against the current problem', async () => {
  const store = useGameStore()
  const sessionA = makeSession('a')
  store.currentSession = sessionA
  store.currentProblem = sessionA.problems[0]

  const pending = deferred<{ hintNumber: 1; content: string; pointDeduction: number }>()
  vi.mocked(gameService.requestHint).mockReturnValue(pending.promise)

  const hinting = store.requestHint()

  // The store moved on to the next problem before the hint arrived
  store.currentProblem = sessionA.problems[1]
  store.hintsUsedCount = 0
  store.hintsReceived = []

  pending.resolve({ hintNumber: 1, content: 'Try counting by sixes', pointDeduction: 5 })
  await hinting

  expect(store.hintsUsedCount).toBe(0)
  expect(store.hintsReceived).toHaveLength(0)
})

test('submitAnswer without an active problem resolves to undefined and calls no service', async () => {
  const store = useGameStore()

  const result = await store.submitAnswer('42')

  expect(result).toBeUndefined()
  expect(gameService.submitAnswer).not.toHaveBeenCalled()
})

test('resumeSession rebuilds mid-game state and seeds hints from the server record', async () => {
  const store = useGameStore()
  const session = makeSession('resumed')
  session.attempts = [makeAttempt(session.problems[0])]
  session.currentProblemIndex = 1
  ;(session as unknown as { hintsRequested: Record<string, number> }).hintsRequested = {
    [session.problems[1].id]: 1
  }
  vi.mocked(gameService.getGameSession).mockResolvedValue(session)

  await store.resumeSession('resumed')

  expect(store.currentSession?.sessionId).toBe('resumed')
  expect(store.currentProblem?.id).toBe(session.problems[1].id)
  expect(store.hintsUsedCount).toBe(1)
  expect(store.currentAttempt?.problemId).toBe(session.problems[1].id)
  expect(store.scorecard).toBeNull()
})

test('resuming a session whose problems are all answered finalizes it into a scorecard', async () => {
  const store = useGameStore()
  const session = makeSession('finished')
  session.attempts = [makeAttempt(session.problems[0]), makeAttempt(session.problems[1])]
  session.currentProblemIndex = 2
  vi.mocked(gameService.getGameSession).mockResolvedValue(session)
  const scorecard = { sessionId: 'finished', totalScore: 30 }
  vi.mocked(gameService.endGameSession).mockResolvedValue(scorecard as never)

  await store.resumeSession('finished')

  expect(store.scorecard).toEqual(scorecard)
})
