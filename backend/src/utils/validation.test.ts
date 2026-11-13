import { validateSubcategories, validateProblemCount } from './validation.js'

describe('validateSubcategories', () => {
  it('accepts every middle-school topic the frontend offers', () => {
    const middleTopics = ['Fractions', 'Decimals', 'Percentages', 'Basic Algebra', 'Geometry']
    const result = validateSubcategories(middleTopics)
    expect(result.isValid).toBe(true)
  })

  it('rejects topics outside the allowlist', () => {
    expect(validateSubcategories(['Calculus']).isValid).toBe(false)
  })

  it('treats a missing value as valid (optional field)', () => {
    expect(validateSubcategories(undefined).isValid).toBe(true)
  })
})

describe('validateProblemCount upper bound', () => {
  it('accepts the largest count the UI offers', () => {
    expect(validateProblemCount(20).isValid).toBe(true)
  })

  it('rejects counts the generator cannot produce in one response', () => {
    expect(validateProblemCount(21).isValid).toBe(false)
    expect(validateProblemCount(50).isValid).toBe(false)
  })
})
