/**
 * Ninja belt rank derived from a player's lifetime total score.
 */

export interface BeltRank {
  name: string
  emoji: string
  /** Score needed for the next belt, or null at the top rank */
  nextAt: number | null
}

const BELTS = [
  { name: 'White', emoji: '🤍', min: 0 },
  { name: 'Yellow', emoji: '💛', min: 250 },
  { name: 'Orange', emoji: '🧡', min: 750 },
  { name: 'Green', emoji: '💚', min: 1500 },
  { name: 'Blue', emoji: '💙', min: 3000 },
  { name: 'Purple', emoji: '💜', min: 5000 },
  { name: 'Brown', emoji: '🤎', min: 8000 },
  { name: 'Black', emoji: '🖤', min: 12000 }
] as const

export function beltRank(totalScore: number): BeltRank {
  const score = Number.isFinite(totalScore) ? Math.max(0, totalScore) : 0
  let index = 0
  for (let i = 0; i < BELTS.length; i++) {
    if (score >= BELTS[i].min) index = i
  }
  const next = BELTS[index + 1]
  return {
    name: BELTS[index].name,
    emoji: BELTS[index].emoji,
    nextAt: next ? next.min : null
  }
}
