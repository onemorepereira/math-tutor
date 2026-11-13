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

describe('percentage answers', () => {
  it('accepts a percent-signed answer when the correct answer is bare', () => {
    expect(checkAnswerCorrect('25%', '25')).toBe(true)
  })

  it('accepts a bare answer when the correct answer carries a percent sign', () => {
    expect(checkAnswerCorrect('25', '25%')).toBe(true)
  })

  it('rejects a wrong percentage either way', () => {
    expect(checkAnswerCorrect('24%', '25')).toBe(false)
    expect(checkAnswerCorrect('24', '25%')).toBe(false)
  })
})

describe('fraction and decimal equivalence', () => {
  it('accepts a fraction when the correct answer is its decimal', () => {
    expect(checkAnswerCorrect('3/8', '0.375')).toBe(true)
  })

  it('accepts a decimal when the correct answer is a fraction', () => {
    expect(checkAnswerCorrect('0.375', '3/8')).toBe(true)
    expect(checkAnswerCorrect('0.4', '2/5')).toBe(true)
  })

  it('accepts decimals that differ only in formatting', () => {
    expect(checkAnswerCorrect('.375', '0.375')).toBe(true)
    expect(checkAnswerCorrect('0.50', '0.5')).toBe(true)
    expect(checkAnswerCorrect('42.0', '42')).toBe(true)
  })

  it('rejects a truncated decimal for a repeating fraction', () => {
    expect(checkAnswerCorrect('0.33', '1/3')).toBe(false)
  })

  it('rejects genuinely different values', () => {
    expect(checkAnswerCorrect('3/8', '0.38')).toBe(false)
    expect(checkAnswerCorrect('1/2', '0.375')).toBe(false)
  })

  it('leaves text answers untouched by numeric comparison', () => {
    expect(checkAnswerCorrect('triangle', 'triangle')).toBe(true)
    expect(checkAnswerCorrect('triangle', 'square')).toBe(false)
  })
})

describe('checkAnswerCorrect — non-string answers from the model', () => {
  it('grades a wrong answer incorrect when correctAnswer is a JSON number', () => {
    expect(checkAnswerCorrect('41', 42 as unknown as string)).toBe(false)
  })

  it('grades a right answer correct when correctAnswer is a JSON number', () => {
    expect(checkAnswerCorrect('42', 42 as unknown as string)).toBe(true)
    expect(checkAnswerCorrect('0.5', 0.5 as unknown as string)).toBe(true)
  })
})

describe('checkAnswerCorrect — spaces between digits', () => {
  it('does not merge separated digit groups into one number', () => {
    expect(checkAnswerCorrect('4 2', '42')).toBe(false)
    expect(checkAnswerCorrect('1 1/2', '11/2')).toBe(false)
  })

  it('reads a mixed number as whole plus fraction', () => {
    expect(checkAnswerCorrect('1 1/2', '3/2')).toBe(true)
    expect(checkAnswerCorrect('1 1/2', '1.5')).toBe(true)
    expect(checkAnswerCorrect('3/2', '1 1/2')).toBe(true)
    expect(checkAnswerCorrect('-2 1/4', '-9/4')).toBe(true)
    expect(checkAnswerCorrect('2 1/4', '-9/4')).toBe(false)
  })
})

describe('checkAnswerCorrect — decorated numeric answers', () => {
  it('accepts a leading variable assignment', () => {
    expect(checkAnswerCorrect('x = 5', '5')).toBe(true)
    expect(checkAnswerCorrect('y=-3', '-3')).toBe(true)
    expect(checkAnswerCorrect('x = 6', '5')).toBe(false)
  })

  it('accepts thousands separators', () => {
    expect(checkAnswerCorrect('1,000', '1000')).toBe(true)
    expect(checkAnswerCorrect('12,345.5', '12345.5')).toBe(true)
    expect(checkAnswerCorrect('1000', '1,000')).toBe(true)
  })

  it('does not read a decimal comma as a thousands separator', () => {
    expect(checkAnswerCorrect('1,5', '1.5')).toBe(false)
    expect(checkAnswerCorrect('1,5', '15')).toBe(false)
  })

  it('accepts a leading dollar sign', () => {
    expect(checkAnswerCorrect('$5', '5')).toBe(true)
    expect(checkAnswerCorrect('$1,250', '1250')).toBe(true)
  })

  it('accepts allowlisted units on either side', () => {
    expect(checkAnswerCorrect('12 cm', '12')).toBe(true)
    expect(checkAnswerCorrect('12', '12 cm')).toBe(true)
    expect(checkAnswerCorrect('12cm', '12 cm')).toBe(true)
    expect(checkAnswerCorrect('45°', '45')).toBe(true)
    expect(checkAnswerCorrect('45 degrees', '45°')).toBe(true)
    expect(checkAnswerCorrect('6 square feet', '6')).toBe(true)
    expect(checkAnswerCorrect('6 ft²', '6 square feet')).toBe(true)
    expect(checkAnswerCorrect('3 hours', '3 hr')).toBe(true)
    expect(checkAnswerCorrect('1/2 kg', '0.5 kg')).toBe(true)
    expect(checkAnswerCorrect('1 1/2 cm', '1.5')).toBe(true)
    expect(checkAnswerCorrect('45 °', '45 degrees')).toBe(true)
    expect(checkAnswerCorrect('12 cm ²', '12 square cm')).toBe(true)
  })

  it('requires units to match when both sides have one', () => {
    expect(checkAnswerCorrect('12 m', '12 cm')).toBe(false)
    expect(checkAnswerCorrect('6 cubic feet', '6 square feet')).toBe(false)
  })

  it('never strips variables or constants', () => {
    expect(checkAnswerCorrect('3', '3x')).toBe(false)
    expect(checkAnswerCorrect('2', '2pi')).toBe(false)
    expect(checkAnswerCorrect('4', '4 i')).toBe(false)
    expect(checkAnswerCorrect('5', '5 apples')).toBe(false)
  })

  it('treats a single letter stuck to a number as a variable, not a unit', () => {
    // "Simplify 2m + m" is 3m: a bare 3 must not pass
    for (const [user, correct] of [['3', '3m'], ['5', '5h'], ['2', '2s'], ['3', '3g'], ['4', '4l'], ['3', '3m²'], ['3m', '3']]) {
      expect(checkAnswerCorrect(user, correct)).toBe(false)
    }
  })

  it('still reads a spaced single-letter unit, and matches the same unit typed without a space', () => {
    expect(checkAnswerCorrect('5', '5 m')).toBe(true)
    expect(checkAnswerCorrect('5 m', '5')).toBe(true)
    expect(checkAnswerCorrect('5m', '5 m')).toBe(true)
    expect(checkAnswerCorrect('9 m²', '9 square m')).toBe(true)
  })

  it('leaves text answers alone', () => {
    expect(checkAnswerCorrect('triangle', 'Triangle')).toBe(true)
    expect(checkAnswerCorrect('x = 5', 'x = 5')).toBe(true)
    expect(checkAnswerCorrect('square', 'cube')).toBe(false)
  })
})
