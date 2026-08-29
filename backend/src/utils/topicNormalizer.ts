/**
 * Folds the model's free-form topic labels ("Fractions to Decimals",
 * "Geometry - Area") into the canonical topic list so stats aggregate
 * cleanly and "Practice This Topic" always passes topic validation.
 */

const KEYWORD_RULES: Array<{ pattern: RegExp; topic: string }> = [
  { pattern: /fraction/, topic: 'Fractions' },
  { pattern: /decimal/, topic: 'Decimals' },
  { pattern: /percent/, topic: 'Percentages' },
  { pattern: /trig/, topic: 'Trigonometry' },
  { pattern: /geometr/, topic: 'Geometry' },
  { pattern: /pattern/, topic: 'Number Patterns' },
  { pattern: /quadratic|equation/, topic: 'Equations' },
  { pattern: /word/, topic: 'Word Problems' },
  { pattern: /multipl/, topic: 'Multiplication' },
  { pattern: /divi/, topic: 'Division' },
  { pattern: /subtract/, topic: 'Subtraction' },
  { pattern: /add/, topic: 'Addition' }
]

export function normalizeTopic(rawTopic: string, difficulty: string): string {
  const lower = rawTopic.toLowerCase()

  if (/algebra/.test(lower)) {
    return difficulty === 'high' ? 'Algebra' : 'Basic Algebra'
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(lower)) {
      return rule.topic
    }
  }

  return rawTopic.trim()
}
