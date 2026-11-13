/**
 * Model output is untrusted: a problem may omit fields, carry the answer as a
 * JSON number, or invent a point value. Normalize what can be normalized and
 * drop what cannot, so one malformed item never fails a whole session and a
 * hallucinated maxPoints never inflates scores.
 */

export const DEFAULT_TOPIC = 'Mixed Practice'
const DEFAULT_MAX_POINTS = 10
const MIN_POINTS = 5
const MAX_POINTS = 20

export interface GeneratedProblem {
  question: string
  correctAnswer: string
  topic: string
  maxPoints: number
  answerType: string
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim() !== '') return value
  return null
}

function toMaxPoints(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return DEFAULT_MAX_POINTS
  return Math.min(MAX_POINTS, Math.max(MIN_POINTS, Math.round(n)))
}

export function sanitizeGeneratedProblems(raw: unknown[]): GeneratedProblem[] {
  if (!Array.isArray(raw)) return []

  const problems: GeneratedProblem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const p = item as Record<string, unknown>

    const question = typeof p.question === 'string' && p.question.trim() !== '' ? p.question : null
    const correctAnswer = toNonEmptyString(p.correctAnswer)
    if (!question || !correctAnswer) continue

    problems.push({
      question,
      correctAnswer,
      topic: typeof p.topic === 'string' && p.topic.trim() !== '' ? p.topic : DEFAULT_TOPIC,
      maxPoints: toMaxPoints(p.maxPoints),
      answerType: typeof p.answerType === 'string' && p.answerType !== '' ? p.answerType : 'numeric'
    })
  }
  return problems
}
