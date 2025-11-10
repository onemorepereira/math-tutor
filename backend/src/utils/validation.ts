/**
 * Input validation utilities for security and data integrity
 */

// Valid math topic categories that can be requested
const VALID_TOPICS = [
  'Addition',
  'Subtraction',
  'Multiplication',
  'Division',
  'Fractions',
  'Decimals',
  'Percentages',
  'Algebra',
  'Geometry',
  'Trigonometry',
  'Word Problems',
  'Number Patterns',
  'Equations'
]

const VALID_AGE_GROUPS = ['elementary', 'middle', 'high']
const VALID_DIFFICULTIES = ['elementary', 'middle', 'high']

// RFC 5321 compliant email regex (simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validate email format and length
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { isValid: false, error: 'Email is required' }
  }

  if (typeof email !== 'string') {
    return { isValid: false, error: 'Email must be a string' }
  }

  // RFC 5321: local part max 64 chars, domain max 255 chars, total max 320
  if (email.length > 320) {
    return { isValid: false, error: 'Email is too long (max 320 characters)' }
  }

  if (email.length < 3) {
    return { isValid: false, error: 'Email is too short' }
  }

  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, error: 'Invalid email format' }
  }

  return { isValid: true }
}

/**
 * Validate age group
 */
export function validateAgeGroup(ageGroup: string): ValidationResult {
  if (!ageGroup) {
    return { isValid: false, error: 'Age group is required' }
  }

  if (!VALID_AGE_GROUPS.includes(ageGroup)) {
    return { isValid: false, error: 'Invalid age group. Must be: elementary, middle, or high' }
  }

  return { isValid: true }
}

/**
 * Validate difficulty level
 */
export function validateDifficulty(difficulty: string): ValidationResult {
  if (!difficulty) {
    return { isValid: false, error: 'Difficulty is required' }
  }

  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    return { isValid: false, error: 'Invalid difficulty. Must be: elementary, middle, or high' }
  }

  return { isValid: true }
}

/**
 * Validate problem count
 */
export function validateProblemCount(count: number): ValidationResult {
  if (typeof count !== 'number' || isNaN(count)) {
    return { isValid: false, error: 'Problem count must be a number' }
  }

  if (!Number.isInteger(count)) {
    return { isValid: false, error: 'Problem count must be an integer' }
  }

  if (count < 1 || count > 50) {
    return { isValid: false, error: 'Problem count must be between 1 and 50' }
  }

  return { isValid: true }
}

/**
 * Validate subcategories array
 */
export function validateSubcategories(subcategories: any): ValidationResult {
  if (!subcategories) {
    return { isValid: true } // Optional field
  }

  if (!Array.isArray(subcategories)) {
    return { isValid: false, error: 'Subcategories must be an array' }
  }

  if (subcategories.length === 0) {
    return { isValid: true } // Empty array is valid
  }

  if (subcategories.length > 10) {
    return { isValid: false, error: 'Too many subcategories (max 10)' }
  }

  // Validate each subcategory
  for (const topic of subcategories) {
    if (typeof topic !== 'string') {
      return { isValid: false, error: 'Each subcategory must be a string' }
    }

    if (topic.length > 100) {
      return { isValid: false, error: 'Subcategory name too long (max 100 characters)' }
    }

    if (!VALID_TOPICS.includes(topic)) {
      return {
        isValid: false,
        error: `Invalid topic: ${topic}. Must be one of: ${VALID_TOPICS.join(', ')}`
      }
    }
  }

  return { isValid: true }
}

/**
 * Validate answer input
 */
export function validateAnswer(answer: any): ValidationResult {
  if (answer === undefined || answer === null) {
    return { isValid: false, error: 'Answer is required' }
  }

  const answerStr = String(answer)

  if (answerStr.length === 0) {
    return { isValid: false, error: 'Answer cannot be empty' }
  }

  // Prevent extremely long answers (potential DoS or data storage issues)
  if (answerStr.length > 1000) {
    return { isValid: false, error: 'Answer is too long (max 1000 characters)' }
  }

  return { isValid: true }
}

/**
 * Validate hint number
 */
export function validateHintNumber(hintNumber: number): ValidationResult {
  if (typeof hintNumber !== 'number' || isNaN(hintNumber)) {
    return { isValid: false, error: 'Hint number must be a number' }
  }

  if (![1, 2].includes(hintNumber)) {
    return { isValid: false, error: 'Hint number must be 1 or 2' }
  }

  return { isValid: true }
}

/**
 * Validate time spent (in seconds)
 */
export function validateTimeSpent(timeSpent: number): ValidationResult {
  if (typeof timeSpent !== 'number' || isNaN(timeSpent)) {
    return { isValid: false, error: 'Time spent must be a number' }
  }

  if (timeSpent < 0) {
    return { isValid: false, error: 'Time spent cannot be negative' }
  }

  // Prevent unrealistic time values (max 1 hour per problem)
  if (timeSpent > 3600) {
    return { isValid: false, error: 'Time spent is unrealistic (max 3600 seconds)' }
  }

  return { isValid: true }
}

/**
 * Validate hints used count
 */
export function validateHintsUsed(hintsUsed: number): ValidationResult {
  if (typeof hintsUsed !== 'number' || isNaN(hintsUsed)) {
    return { isValid: false, error: 'Hints used must be a number' }
  }

  if (!Number.isInteger(hintsUsed)) {
    return { isValid: false, error: 'Hints used must be an integer' }
  }

  if (hintsUsed < 0 || hintsUsed > 2) {
    return { isValid: false, error: 'Hints used must be between 0 and 2' }
  }

  return { isValid: true }
}

/**
 * Validate Cognito ID format (UUID)
 */
export function validateCognitoId(cognitoId: string): ValidationResult {
  if (!cognitoId) {
    return { isValid: false, error: 'Cognito ID is required' }
  }

  // Cognito sub is a UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (!uuidRegex.test(cognitoId)) {
    return { isValid: false, error: 'Invalid Cognito ID format' }
  }

  return { isValid: true }
}

/**
 * Sanitize string input by removing control characters
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input) return ''

  // Remove control characters except newlines and tabs
  const sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Trim and limit length
  return sanitized.trim().substring(0, maxLength)
}
