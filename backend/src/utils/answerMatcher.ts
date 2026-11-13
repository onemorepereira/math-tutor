/**
 * Answer-matching helpers for validating user answers against the expected answer.
 *
 * Supports exact (normalized) matching and fraction-equivalence matching so that,
 * e.g., "2/4" is accepted when the correct answer is "1/2".
 */

/**
 * Drops whitespace, except a single space between two digits: "4 2" must not
 * become "42", and "1 1/2" (a mixed number) must not become "11/2".
 */
function collapseWhitespace(str: string): string {
  return str.trim().replace(/\s+/g, (_match, offset: number, whole: string) => {
    const before = whole[offset - 1]
    const after = whole[offset + _match.length]
    return /\d/.test(before ?? '') && /\d/.test(after ?? '') ? ' ' : ''
  })
}

// Model output can carry answers as JSON numbers, so accept anything stringable
export function normalizeAnswer(answer: string): string {
  // A trailing percent sign is cosmetic ("25%" and "25" are the same answer)
  return collapseWhitespace(String(answer).toLowerCase()).replace(/%$/, '')
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b !== 0) {
    const temp = b
    b = a % b
    a = temp
  }
  return a
}

export function parseFraction(str: string): { numerator: number; denominator: number } | null {
  const normalized = collapseWhitespace(String(str))
  const match = normalized.match(/^(-?\d+)\/(-?\d+)$/)
  if (!match) return null

  const numerator = parseInt(match[1], 10)
  const denominator = parseInt(match[2], 10)

  if (denominator === 0 || isNaN(numerator) || isNaN(denominator)) return null

  return { numerator, denominator }
}

export function simplifyFraction(
  numerator: number,
  denominator: number
): { numerator: number; denominator: number } {
  const divisor = gcd(numerator, denominator)
  let simplifiedNum = numerator / divisor
  let simplifiedDen = denominator / divisor

  // Ensure denominator is positive (move negative sign to numerator)
  if (simplifiedDen < 0) {
    simplifiedNum = -simplifiedNum
    simplifiedDen = -simplifiedDen
  }

  return { numerator: simplifiedNum, denominator: simplifiedDen }
}

export function areFractionsEquivalent(answer: string, correctAnswer: string): boolean {
  const userFraction = parseFraction(answer)
  const correctFraction = parseFraction(correctAnswer)

  if (!userFraction || !correctFraction) return false

  const simplifiedUser = simplifyFraction(userFraction.numerator, userFraction.denominator)
  const simplifiedCorrect = simplifyFraction(correctFraction.numerator, correctFraction.denominator)

  return simplifiedUser.numerator === simplifiedCorrect.numerator &&
         simplifiedUser.denominator === simplifiedCorrect.denominator
}

/**
 * Numeric value of an answer expressed as a fraction ("3/8") or a plain
 * decimal ("0.375", ".375", "42"); null when the string is not numeric.
 */
export function numericValue(str: string): number | null {
  const normalized = normalizeAnswer(str)

  const fraction = parseFraction(normalized)
  if (fraction) {
    return fraction.numerator / fraction.denominator
  }

  // Mixed number: "1 1/2" is 3/2, "-2 1/4" is -9/4
  const mixed = normalized.match(/^(-?)(\d+) (\d+)\/(\d+)$/)
  if (mixed) {
    const denominator = parseInt(mixed[4], 10)
    if (denominator === 0) return null
    const magnitude = parseInt(mixed[2], 10) + parseInt(mixed[3], 10) / denominator
    return mixed[1] === '-' ? -magnitude : magnitude
  }

  if (/^-?(\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return parseFloat(normalized)
  }

  return null
}

export function checkAnswerCorrect(userAnswer: string, correctAnswer: string): boolean {
  // First try exact match (normalized)
  if (normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer)) {
    return true
  }

  // Then try fraction equivalence
  if (areFractionsEquivalent(userAnswer, correctAnswer)) {
    return true
  }

  // Finally try numeric equivalence, so "3/8" matches "0.375" and
  // "0.50" matches "0.5" (repeating decimals stay exact: "0.33" != 1/3)
  const userValue = numericValue(userAnswer)
  const correctValue = numericValue(correctAnswer)
  if (userValue !== null && correctValue !== null) {
    return Math.abs(userValue - correctValue) < 1e-9
  }

  return false
}
