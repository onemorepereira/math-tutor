/**
 * Answer-matching helpers for validating user answers against the expected answer.
 *
 * Supports exact (normalized) matching and fraction-equivalence matching so that,
 * e.g., "2/4" is accepted when the correct answer is "1/2".
 */

export function normalizeAnswer(answer: string): string {
  return answer.toString().toLowerCase().trim().replace(/\s+/g, '')
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

export function checkAnswerCorrect(userAnswer: string, correctAnswer: string): boolean {
  // First try exact match (normalized)
  if (normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer)) {
    return true
  }

  // Then try fraction equivalence
  if (areFractionsEquivalent(userAnswer, correctAnswer)) {
    return true
  }

  return false
}
