import { afterEach, describe, expect, it } from 'vitest'
import { bucketSessionsByLocalDay, localDateKey, parseDateKey } from './dates'

const originalTz = process.env.TZ

afterEach(() => {
  process.env.TZ = originalTz
})

describe.each(['America/Chicago', 'Africa/Cairo', 'Asia/Tokyo'])('in %s', (tz) => {
  it('keys a local midnight by its own calendar date', () => {
    process.env.TZ = tz
    expect(localDateKey(new Date(2026, 10, 12))).toBe('2026-11-12')
    expect(localDateKey(new Date(2026, 10, 12, 23, 59))).toBe('2026-11-12')
  })

  it('parses a key back to the same local calendar date', () => {
    process.env.TZ = tz
    const date = parseDateKey('2026-11-12')
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 12])
  })
})

describe('bucketSessionsByLocalDay', () => {
  it('counts a US evening game on the local day, not the UTC day', () => {
    process.env.TZ = 'America/Chicago'
    // 9pm CST on Nov 12 is already Nov 13 in UTC
    const activity = bucketSessionsByLocalDay([
      { startTime: '2026-11-13T03:00:00.000Z', isCompleted: true, totalTimeSeconds: 120 },
      { startTime: '2026-11-12T15:00:00.000Z', isCompleted: true, totalTimeSeconds: 60 },
      { startTime: '2026-11-12T16:00:00.000Z', isCompleted: false, totalTimeSeconds: 30 }
    ])
    expect(activity).toEqual({ '2026-11-12': { sessionCount: 2, totalTime: 180 } })
  })
})
