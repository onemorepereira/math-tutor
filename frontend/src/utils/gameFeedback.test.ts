import { describe, expect, it } from 'vitest'
import type { GameSession, MathProblem, ProblemAttempt } from '@/types'
import {
  formatTip,
  praiseFor,
  currentStreak,
  displayedProblemNumber,
  answeredCount,
  hintPenaltyLine,
  PRAISE
} from './gameFeedback'

function problem(over: Partial<MathProblem> = {}): MathProblem {
  return { id: 'p1', question: 'q', correctAnswer: '1', difficulty: 'elementary', topic: 'Addition', maxPoints: 10, ...over }
}

function attempt(isCorrect: boolean): ProblemAttempt {
  return { problemId: 'x', problem: problem(), userAnswer: '1', isCorrect, hintsUsed: 0, timeSpentSeconds: 1, pointsEarned: 0, startTime: 0 }
}

function session(problems: MathProblem[], attempts: ProblemAttempt[], currentProblemIndex: number): GameSession {
  return { problems, attempts, currentProblemIndex } as unknown as GameSession
}

describe('formatTip', () => {
  it('shows fraction formats for the Fractions topic', () => {
    expect(formatTip(problem({ topic: 'Fractions' }))).toBe('Tip: type it like 3/4 or 1 1/2')
  })

  it('shows a plain-number tip for other numeric problems', () => {
    expect(formatTip(problem({ answerType: 'numeric' }))).toBe('Tip: just the number, like 12 or -3.5')
    expect(formatTip(problem())).toBe('Tip: just the number, like 12 or -3.5')
  })

  it('shows a word tip for text answers', () => {
    expect(formatTip(problem({ answerType: 'text', topic: 'Fractions' }))).toBe('Tip: a word or short phrase')
  })
})

describe('praiseFor', () => {
  it('rotates through the praise phrases', () => {
    expect(PRAISE).toEqual(['Correct!', 'Nailed it!', 'Great job!', 'You got it!'])
    expect([0, 1, 2, 3, 4].map(praiseFor)).toEqual([...PRAISE, 'Correct!'])
  })
})

describe('currentStreak', () => {
  it('counts consecutive correct answers from the latest one', () => {
    expect(currentStreak([])).toBe(0)
    expect(currentStreak([attempt(true), attempt(false), attempt(true), attempt(true)])).toBe(2)
    expect(currentStreak([attempt(true), attempt(false)])).toBe(0)
  })
})

describe('displayedProblemNumber', () => {
  const problems = [problem({ id: 'a' }), problem({ id: 'b' }), problem({ id: 'c' })]

  it('keeps showing the answered problem while its feedback is on screen', () => {
    // The store advances the index on submit, before the next problem loads
    expect(displayedProblemNumber(session(problems, [attempt(true)], 1), problems[0])).toBe(1)
  })

  it('falls back to the session index when no problem is current', () => {
    expect(displayedProblemNumber(session(problems, [], 2), null)).toBe(3)
  })

  it('never exceeds the total', () => {
    expect(displayedProblemNumber(session(problems, [], 3), null)).toBe(3)
  })
})

describe('answeredCount', () => {
  it('counts recorded attempts', () => {
    expect(answeredCount(session([problem()], [attempt(true)], 1))).toBe(1)
    expect(answeredCount(null)).toBe(0)
  })
})

describe('hintPenaltyLine', () => {
  it('says how many hints were already used and what they cost', () => {
    expect(hintPenaltyLine(1)).toBe('You already used 1 hint on this problem (−5 pts).')
    expect(hintPenaltyLine(2)).toBe('You already used 2 hints on this problem (−10 pts).')
  })
})
