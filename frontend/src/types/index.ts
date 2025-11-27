export type DifficultyLevel = 'elementary' | 'middle' | 'high'

export interface Subcategories {
  elementary: string[]
  middle: string[]
  high: string[]
}

export const SUBCATEGORIES: Subcategories = {
  elementary: ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Number Patterns'],
  middle: ['Fractions', 'Decimals', 'Percentages', 'Basic Algebra', 'Geometry'],
  high: ['Algebra', 'Quadratic Equations', 'Geometry', 'Trigonometry', 'Advanced Problems']
}

export interface User {
  id: string
  email: string
  screenName: string
  ageGroup?: DifficultyLevel
  createdAt: string
}

export type AnswerType = 'numeric' | 'text'

export interface MathProblem {
  id: string
  question: string
  correctAnswer: string
  difficulty: DifficultyLevel
  topic: string
  maxPoints: number
  answerType?: AnswerType
}

export interface Hint {
  hintNumber: 1 | 2
  content: string
  pointDeduction: number
}

export interface ProblemAttempt {
  problemId: string
  problem: MathProblem
  userAnswer: string
  isCorrect: boolean
  hintsUsed: number
  timeSpentSeconds: number
  pointsEarned: number
  startTime: number
  endTime?: number
}

export interface GameSession {
  sessionId: string
  userId: string
  startTime: string
  endTime?: string
  difficulty: DifficultyLevel
  subcategories?: string[]
  problems: MathProblem[]
  attempts: ProblemAttempt[]
  currentProblemIndex: number
  totalScore: number
  totalTimeSeconds: number
  isCompleted: boolean
}

export interface Scorecard {
  sessionId: string
  totalScore: number
  maxPossibleScore: number
  totalTimeSeconds: number
  correctAnswers: number
  incorrectAnswers: number
  hintsUsed: number
  attempts: ProblemAttempt[]
}

export interface SolutionExplanation {
  problemId: string
  explanation: string
  steps: string[]
  ageAppropriateInsight: string
}
