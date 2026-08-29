import { normalizeTopic } from './topicNormalizer.js'

describe('normalizeTopic', () => {
  it('folds free-form fraction labels into Fractions', () => {
    expect(normalizeTopic('Fractions to Decimals', 'middle')).toBe('Fractions')
    expect(normalizeTopic('Fractions in Word Problems', 'elementary')).toBe('Fractions')
    expect(normalizeTopic('Fraction Comparison', 'elementary')).toBe('Fractions')
    expect(normalizeTopic('Fractions (Halves)', 'elementary')).toBe('Fractions')
  })

  it('folds geometry variants into Geometry', () => {
    expect(normalizeTopic('Geometry - Area', 'middle')).toBe('Geometry')
  })

  it('folds combined operation labels into the first operation', () => {
    expect(normalizeTopic('Multiplication and Subtraction', 'elementary')).toBe('Multiplication')
  })

  it('maps algebra by grade', () => {
    expect(normalizeTopic('Algebra Basics', 'middle')).toBe('Basic Algebra')
    expect(normalizeTopic('Algebra', 'high')).toBe('Algebra')
  })

  it('keeps canonical topics unchanged', () => {
    expect(normalizeTopic('Addition', 'elementary')).toBe('Addition')
    expect(normalizeTopic('Percentages', 'middle')).toBe('Percentages')
    expect(normalizeTopic('Number Patterns', 'elementary')).toBe('Number Patterns')
  })

  it('passes through labels it cannot classify', () => {
    expect(normalizeTopic('Roman Numerals', 'elementary')).toBe('Roman Numerals')
  })
})
