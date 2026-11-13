import { sanitizeGeneratedProblems, DEFAULT_TOPIC } from './problemSanitizer.js'

describe('sanitizeGeneratedProblems', () => {
  it('keeps well-formed problems unchanged', () => {
    const raw = [{ question: 'What is 2 + 2?', correctAnswer: '4', topic: 'Addition', maxPoints: 10, answerType: 'numeric' }]
    expect(sanitizeGeneratedProblems(raw)).toEqual(raw)
  })

  it('drops items without a usable question or answer', () => {
    const raw = [
      { question: '', correctAnswer: '4', topic: 'Addition', maxPoints: 10 },
      { question: 'What is 3 + 3?', topic: 'Addition', maxPoints: 10 },
      { question: { text: 'nested' }, correctAnswer: '1', topic: 'Addition', maxPoints: 10 },
      null,
      'not an object',
      { question: 'What is 5 + 5?', correctAnswer: '10', topic: 'Addition', maxPoints: 10 }
    ]
    expect(sanitizeGeneratedProblems(raw).map(p => p.question)).toEqual(['What is 5 + 5?'])
  })

  it('stringifies numeric answers', () => {
    const [p] = sanitizeGeneratedProblems([{ question: '6 x 7', correctAnswer: 42, topic: 'Multiplication', maxPoints: 10 }])
    expect(p.correctAnswer).toBe('42')
  })

  it('clamps maxPoints to an integer between 5 and 20', () => {
    const points = [1000, -5, '15', 'lots', undefined, 12.6].map(maxPoints =>
      sanitizeGeneratedProblems([{ question: 'q', correctAnswer: '1', topic: 'Addition', maxPoints }])[0].maxPoints
    )
    expect(points).toEqual([20, 5, 15, 10, 10, 13])
  })

  it('defaults a missing topic and answerType', () => {
    const [p] = sanitizeGeneratedProblems([{ question: 'q', correctAnswer: '1', maxPoints: 10 }])
    expect(p.topic).toBe(DEFAULT_TOPIC)
    expect(p.answerType).toBe('numeric')
  })

  it('returns an empty list for non-array input', () => {
    expect(sanitizeGeneratedProblems({ problems: [] } as unknown as unknown[])).toEqual([])
  })
})
