import { expect, test } from 'vitest'
import { beltRank } from '@/utils/belt'

test('a brand-new player is a White belt working toward Yellow', () => {
  const rank = beltRank(0)
  expect(rank.name).toBe('White')
  expect(rank.nextAt).toBe(250)
})

test('reaching a threshold awards that belt', () => {
  expect(beltRank(250).name).toBe('Yellow')
})

test('one point shy of a threshold keeps the previous belt', () => {
  const rank = beltRank(11999)
  expect(rank.name).toBe('Brown')
  expect(rank.nextAt).toBe(12000)
})

test('a Black belt has no next threshold', () => {
  const rank = beltRank(50000)
  expect(rank.name).toBe('Black')
  expect(rank.nextAt).toBeNull()
})

test('a defensive default for bad input', () => {
  expect(beltRank(-5).name).toBe('White')
})
