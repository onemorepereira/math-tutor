/**
 * Formats a duration in seconds as a clock string, e.g. 125 -> "2:05".
 */
export function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
