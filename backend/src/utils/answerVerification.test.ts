import { reconcileVerifiedAnswers } from './answerVerification.js'

const problem = (id: string, correctAnswer: string, answerType = 'numeric') => ({
  id,
  question: `q-${id}`,
  correctAnswer,
  answerType
})

describe('reconcileVerifiedAnswers', () => {
  it('keeps problems whose independent solve agrees', () => {
    const problems = [problem('a', '3'), problem('b', '42')]
    const result = reconcileVerifiedAnswers(problems, { a: '3', b: '42' })

    expect(result.problems).toHaveLength(2)
    expect(result.droppedIds).toEqual([])
  })

  it('drops a numeric problem whose independent solve disagrees', () => {
    const problems = [problem('a', '21'), problem('b', '42')]
    const result = reconcileVerifiedAnswers(problems, { a: '3', b: '42' })

    expect(result.problems.map(p => p.id)).toEqual(['b'])
    expect(result.droppedIds).toEqual(['a'])
  })

  it('does not drop over formatting differences', () => {
    const problems = [problem('a', '0.5'), problem('b', '1/2'), problem('c', '25%')]
    const result = reconcileVerifiedAnswers(problems, { a: '.50', b: '2/4', c: '25' })

    expect(result.droppedIds).toEqual([])
  })

  it('keeps a problem the verifier did not answer', () => {
    const problems = [problem('a', '3')]
    const result = reconcileVerifiedAnswers(problems, {})

    expect(result.problems).toHaveLength(1)
    expect(result.droppedIds).toEqual([])
  })

  it('compares text answers case-insensitively', () => {
    const problems = [problem('a', 'Triangle', 'text'), problem('b', 'Square', 'text')]
    const result = reconcileVerifiedAnswers(problems, { a: 'triangle', b: 'circle' })

    expect(result.problems.map(p => p.id)).toEqual(['a'])
    expect(result.droppedIds).toEqual(['b'])
  })
})
