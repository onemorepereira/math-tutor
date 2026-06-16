import {
  normalizeAnswer,
  gcd,
  parseFraction,
  simplifyFraction,
  areFractionsEquivalent,
  checkAnswerCorrect
} from './answerMatcher.js'

describe('normalizeAnswer', () => {
  it('lowercases, trims, and strips all whitespace', () => {
    expect(normalizeAnswer('  Hello World ')).toBe('helloworld')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeAnswer('1 / 2')).toBe('1/2')
  })

  it('leaves an already-normalized string unchanged', () => {
    expect(normalizeAnswer('42')).toBe('42')
  })
})

describe('gcd', () => {
  it('computes the greatest common divisor', () => {
    expect(gcd(12, 8)).toBe(4)
    expect(gcd(7, 13)).toBe(1)
  })

  it('handles zero operands', () => {
    expect(gcd(0, 5)).toBe(5)
    expect(gcd(5, 0)).toBe(5)
  })

  it('uses absolute values for negatives', () => {
    expect(gcd(-12, 8)).toBe(4)
    expect(gcd(12, -8)).toBe(4)
  })
})

describe('parseFraction', () => {
  it('parses a simple fraction', () => {
    expect(parseFraction('3/4')).toEqual({ numerator: 3, denominator: 4 })
  })

  it('ignores surrounding and internal whitespace', () => {
    expect(parseFraction(' 3 / 4 ')).toEqual({ numerator: 3, denominator: 4 })
  })

  it('parses negative numerators and denominators', () => {
    expect(parseFraction('-3/4')).toEqual({ numerator: -3, denominator: 4 })
    expect(parseFraction('3/-4')).toEqual({ numerator: 3, denominator: -4 })
  })

  it('returns null for a zero denominator', () => {
    expect(parseFraction('1/0')).toBeNull()
  })

  it('returns null for non-fraction input', () => {
    expect(parseFraction('5')).toBeNull()
    expect(parseFraction('abc')).toBeNull()
    expect(parseFraction('1/2/3')).toBeNull()
    expect(parseFraction('1.5/2')).toBeNull()
    expect(parseFraction('')).toBeNull()
  })
})

describe('simplifyFraction', () => {
  it('reduces to lowest terms', () => {
    expect(simplifyFraction(2, 4)).toEqual({ numerator: 1, denominator: 2 })
    expect(simplifyFraction(6, 9)).toEqual({ numerator: 2, denominator: 3 })
  })

  it('leaves an already-reduced fraction unchanged', () => {
    expect(simplifyFraction(1, 2)).toEqual({ numerator: 1, denominator: 2 })
  })

  it('moves a negative denominator sign to the numerator', () => {
    expect(simplifyFraction(1, -2)).toEqual({ numerator: -1, denominator: 2 })
    expect(simplifyFraction(-2, -4)).toEqual({ numerator: 1, denominator: 2 })
  })

  it('simplifies improper fractions', () => {
    expect(simplifyFraction(4, 2)).toEqual({ numerator: 2, denominator: 1 })
  })
})

describe('areFractionsEquivalent', () => {
  it('treats unreduced fractions as equivalent to their reduced form', () => {
    expect(areFractionsEquivalent('2/4', '1/2')).toBe(true)
    expect(areFractionsEquivalent('3/6', '1/2')).toBe(true)
  })

  it('treats differently-signed equivalent fractions as equal', () => {
    expect(areFractionsEquivalent('-1/2', '1/-2')).toBe(true)
    expect(areFractionsEquivalent('-2/4', '-1/2')).toBe(true)
  })

  it('returns false for non-equivalent fractions', () => {
    expect(areFractionsEquivalent('1/2', '1/3')).toBe(false)
  })

  it('returns false when either side is not a fraction', () => {
    expect(areFractionsEquivalent('0.5', '1/2')).toBe(false)
    expect(areFractionsEquivalent('1/2', 'half')).toBe(false)
  })

  it('returns false when a denominator is zero', () => {
    expect(areFractionsEquivalent('1/0', '1/2')).toBe(false)
  })
})

describe('checkAnswerCorrect', () => {
  it('accepts an exact match', () => {
    expect(checkAnswerCorrect('42', '42')).toBe(true)
  })

  it('accepts a match that differs only by case and whitespace', () => {
    expect(checkAnswerCorrect('  X = 5 ', 'x=5')).toBe(true)
  })

  it('accepts an equivalent-but-unreduced fraction', () => {
    expect(checkAnswerCorrect('2/4', '1/2')).toBe(true)
  })

  it('rejects a wrong answer', () => {
    expect(checkAnswerCorrect('7', '8')).toBe(false)
    expect(checkAnswerCorrect('1/3', '1/2')).toBe(false)
  })
})
