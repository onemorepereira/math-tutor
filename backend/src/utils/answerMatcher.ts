/**
 * Answer-matching helpers for validating user answers against the expected answer.
 *
 * Supports exact (normalized) matching and fraction-equivalence matching so that,
 * e.g., "2/4" is accepted when the correct answer is "1/2".
 */

export function normalizeAnswer(answer: string): string {
  // A trailing percent sign is cosmetic ("25%" and "25" are the same answer)
  return answer.toString().toLowerCase().trim().replace(/\s+/g, '').replace(/%$/, '')
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
  const normalized = str.trim().replace(/\s+/g, '')
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
