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

// Units a kid (or the model) may write after a number, mapped to one canonical
// spelling. Only these are stripped, so variables and constants ("3x", "2pi",
// "4 i") never collapse into a bare number.
const LENGTH_UNITS: Record<string, string> = {
  mm: 'mm', cm: 'cm', m: 'm', km: 'km',
  in: 'in', inch: 'in', inches: 'in',
  ft: 'ft', foot: 'ft', feet: 'ft',
  yd: 'yd', yard: 'yd', yards: 'yd',
  mi: 'mi', mile: 'mi', miles: 'mi'
}

const OTHER_UNITS: Record<string, string> = {
  g: 'g', kg: 'kg', mg: 'mg', lb: 'lb', lbs: 'lb', oz: 'oz',
  l: 'l', ml: 'ml', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  s: 's', sec: 's', secs: 's', second: 's', seconds: 's',
  min: 'min', mins: 'min', minute: 'min', minutes: 'min',
  h: 'h', hr: 'h', hrs: 'h', hour: 'h', hours: 'h',
  day: 'day', days: 'day', week: 'week', weeks: 'week', year: 'year', years: 'year',
  degree: '°', degrees: '°', '°': '°'
}

// A single letter written straight after a number ("3m", "5h") is a variable
// in algebra, not a unit; only "3 m" (with a space) reads as a unit
function isUnitToken(token: string, gap: string): boolean {
  return token.length > 1 || !/^[a-z]$/.test(token) || gap.length > 0
}

function splitUnit(s: string): { rest: string; unit: string | null } {
  const areaOrVolume = s.match(/^(.*?)\s*(square|cubic)\s+([a-z]+)$/)
  if (areaOrVolume && LENGTH_UNITS[areaOrVolume[3]]) {
    return { rest: areaOrVolume[1], unit: LENGTH_UNITS[areaOrVolume[3]] + (areaOrVolume[2] === 'square' ? '²' : '³') }
  }

  const powered = s.match(/^(.*?)(\s*)([a-z]+)\s*([²³])$/)
  if (powered && LENGTH_UNITS[powered[3]] && isUnitToken(powered[3], powered[2])) {
    return { rest: powered[1], unit: LENGTH_UNITS[powered[3]] + powered[4] }
  }

  const plain = s.match(/^(.*?)(\s*)(°|[a-z]+)$/)
  const unit = plain && (LENGTH_UNITS[plain[3]] ?? OTHER_UNITS[plain[3]])
  if (plain && unit && plain[1] && isUnitToken(plain[3], plain[2])) {
    return { rest: plain[1], unit }
  }

  return { rest: s, unit: null }
}

/**
 * Numeric value and unit of an answer written with everyday decorations:
 * "x = 5", "$1,250", "12 cm", "45°", "6 square feet". Null when what is left
 * after removing them is not a number (so text answers are never affected).
 */
export function parseDecorated(answer: string): { value: number; unit: string | null } | null {
  let s = String(answer).toLowerCase().trim()
  s = s.replace(/^[a-z]\s*=\s*/, '')
  s = s.replace(/^\$\s*/, '')

  const { rest, unit } = splitUnit(s)
  let number = rest.trim()

  // Thousands separators only in groups of three ("1,000"), so "1,5" stays non-numeric
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(number)) {
    number = number.replace(/,/g, '')
  }

  const value = numericValue(number)
  return value === null ? null : { value, unit }
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

  // Last, the same value written with units, "x =", "$" or thousands commas;
  // when both sides name a unit it has to be the same one
  const user = parseDecorated(userAnswer)
  const correct = parseDecorated(correctAnswer)
  if (user && correct) {
    if (user.unit && correct.unit && user.unit !== correct.unit) return false
    return Math.abs(user.value - correct.value) < 1e-9
  }

  return false
}
