/**
 * Calendar-day helpers that stay in the viewer's local time zone.
 * `toISOString()` converts to UTC first, which shifts local midnights (and
 * evening timestamps) onto the neighboring day.
 */

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/** "YYYY-MM-DD" for the local calendar date of `date`. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local midnight of a "YYYY-MM-DD" key (`new Date(key)` would parse it as UTC). */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export interface DayActivity {
  sessionCount: number
  totalTime: number
}

/** Completed sessions grouped by the local day they started on. */
export function bucketSessionsByLocalDay(
  sessions: Array<{ startTime: string; isCompleted: boolean; totalTimeSeconds?: number }>
): Record<string, DayActivity> {
  const activity: Record<string, DayActivity> = {}
  for (const session of sessions) {
    if (!session.isCompleted) continue
    const key = localDateKey(new Date(session.startTime))
    activity[key] ??= { sessionCount: 0, totalTime: 0 }
    activity[key].sessionCount += 1
    activity[key].totalTime += session.totalTimeSeconds || 0
  }
  return activity
}
