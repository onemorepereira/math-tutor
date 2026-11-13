import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Accessibility rules that only CSS can carry. A headless-browser render
// checks them visually; this keeps them from being dropped by accident.

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const globalCss = read('./style.css')
const gameView = read('./views/GameView.vue')

/** WCAG 2.x contrast ratio between two #rrggbb colours */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `missing rule ${selector}`).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('}', start))
}

describe('accessibility styles', () => {
  it('shows a solid focus ring of at least 3px with 3:1 contrast', () => {
    const ring = block(globalCss, ':focus-visible')
    expect(ring).toMatch(/outline:\s*3px solid #4c51bf/)
    expect(contrast('#4c51bf', '#ffffff')).toBeGreaterThanOrEqual(3)
    expect(globalCss).not.toMatch(/\.form-group input:focus[^}]*outline:\s*none/)
    expect(gameView).not.toMatch(/\.feedback-card:focus\s*\{[^}]*outline:\s*none/)
  })

  it('turns motion off for players who ask for reduced motion', () => {
    const start = globalCss.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(start).toBeGreaterThanOrEqual(0)
    const media = globalCss.slice(start, start + 600)
    expect(media).toMatch(/animation-duration:\s*0\.01ms !important/)
    expect(media).toMatch(/transition-duration:\s*0\.01ms !important/)
  })

  it('hides the Enter hint on touch screens', () => {
    expect(gameView).toMatch(/@media \(hover: none\) and \(pointer: coarse\)\s*\{\s*\.feedback-card \.hint-text\s*\{\s*display:\s*none/)
  })

  it('keeps the question at 1.5rem or larger on phones', () => {
    const phoneRules = gameView.slice(gameView.indexOf('@media (max-width: 768px)'))
    const sizes = [...phoneRules.matchAll(/\.problem-question\s*\{[^}]*font-size:\s*([\d.]+)rem/g)].map((m) => Number(m[1]))
    expect(sizes.length).toBe(2)
    sizes.forEach((size) => expect(size).toBeGreaterThanOrEqual(1.5))
  })

  it('gives the hint penalty AA contrast on the hint background', () => {
    expect(block(gameView, '.hint-penalty')).toMatch(/color:\s*#a71d2a/)
    expect(block(gameView, '.hints-section')).toMatch(/background:\s*#fff3cd/)
    expect(contrast('#a71d2a', '#fff3cd')).toBeGreaterThanOrEqual(4.5)
  })
})
