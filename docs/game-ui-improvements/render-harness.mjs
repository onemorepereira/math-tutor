// Renders the real Number Ninja frontend (Vite dev server) in headless Chrome.
// Only the network is faked: Cognito tokens are seeded in localStorage and
// every http://api.test/api/... call is answered here.
import { chromium } from 'playwright-core'

const APP = process.env.APP_URL ?? 'http://127.0.0.1:3100'
const SHOTS = new URL('./shots/', import.meta.url).pathname
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const jwt = (p) => `${b64({ alg: 'none', kid: 'x' })}.${b64(p)}.sig`
const claims = { sub: 'sub-1', exp: now + 3600, iat: now, email: 'kid@example.com', 'cognito:username': 'kid', 'custom:ageGroup': 'middle', token_use: 'id' }
const prefix = 'CognitoIdentityServiceProvider.testclient'
const storage = {
  [`${prefix}.LastAuthUser`]: 'kid',
  [`${prefix}.kid.idToken`]: jwt(claims),
  [`${prefix}.kid.accessToken`]: jwt({ ...claims, token_use: 'access' }),
  [`${prefix}.kid.refreshToken`]: 'refresh',
  [`${prefix}.kid.clockDrift`]: '0'
}

const user = { userId: 'u1', cognitoId: 'sub-1', screenName: 'SwiftMeadow586', ageGroup: 'middle', totalScore: 120, gamesPlayed: 3 }
const problems = [
  { id: 'p1', question: 'What is 1/4 + 2/4?', correctAnswer: '3/4', difficulty: 'middle', topic: 'Fractions', maxPoints: 10, answerType: 'numeric' },
  { id: 'p2', question: 'What is 7 × 6?', correctAnswer: '42', difficulty: 'middle', topic: 'Multiplication', maxPoints: 5, answerType: 'numeric' },
  { id: 'p3', question: 'A rectangle is 3 cm by 4 cm. What is its area?', correctAnswer: '12 square cm', difficulty: 'middle', topic: 'Geometry', maxPoints: 15, answerType: 'numeric' },
  { id: 'p4', question: 'Name a shape with three sides.', correctAnswer: 'triangle', difficulty: 'middle', topic: 'Geometry', maxPoints: 10, answerType: 'text' }
]

function freshSession(over = {}) {
  return {
    sessionId: 's1', userId: 'u1', difficulty: 'middle', subcategories: [], problems: structuredClone(problems),
    attempts: [], currentProblemIndex: 0, totalScore: 0, totalTimeSeconds: 0, hintsRequested: {},
    startTime: new Date().toISOString(), isCompleted: false, ...over
  }
}

async function fakeApi(page, opts = {}) {
  let hints = 0
  await page.route('http://api.test/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (path === '/api/users/profile') return json({ user })
    if (path === '/api/users/sessions') return json({ sessions: opts.serverSessions ?? [], statistics: {} })
    if (path === '/api/public/leaderboard') return json({ leaderboard: [] })
    if (path === '/api/public/activity') return json({ activityByDate: {} })
    if (path === '/api/game/sessions' && req.method() === 'POST') return json({ session: freshSession() }, 201)
    if (path === '/api/game/sessions/s1' && req.method() === 'GET') return json({ session: opts.resumeSession ?? freshSession() })
    if (path.endsWith('/hints')) {
      hints++
      return json({ hint: { hintNumber: hints, content: hints === 1 ? 'Both pieces are quarters, so keep the bottom number.' : 'Add the top numbers: 1 + 2.', pointDeduction: 5 } })
    }
    if (path.endsWith('/submit')) {
      const { answer } = req.postDataJSON()
      const id = path.split('/')[6]
      const p = problems.find((x) => x.id === id)
      const ok = answer.trim().toLowerCase() === p.correctAnswer.toLowerCase() || (id === 'p3' && answer.includes('12'))
      const points = ok ? Math.max(0, p.maxPoints - 5 * hints) : 0
      hints = 0
      return json({ isCorrect: ok, pointsEarned: points, correctAnswer: p.correctAnswer })
    }
    if (path.endsWith('/explanation')) {
      if (opts.explanationFails) return json({ error: 'boom' }, 500)
      await new Promise((r) => setTimeout(r, 400))
      return json({ explanation: { problemId: 'x', explanation: 'When fractions have the same bottom number, you only add the top numbers.', steps: ['Keep the bottom number: 4', 'Add the tops: 1 + 2 = 3', 'So the answer is 3/4'], ageAppropriateInsight: 'Think of a pizza cut into 4 slices!' } })
    }
    if (path.endsWith('/end')) return json({ scorecard: { sessionId: 's1', totalScore: 10, maxPossibleScore: 40, attempts: [], totalTimeSeconds: 30 } })
    return json({ error: `unhandled ${req.method()} ${path}` }, 404)
  })
}

async function newPage(browser, { mobile, reducedMotion = 'no-preference', ...opts } = {}) {
  const context = await browser.newContext(mobile
    ? { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion }
    : { viewport: { width: 1280, height: 900 }, reducedMotion })
  await context.addInitScript((items) => { for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v) }, storage)
  const page = await context.newPage()
  page.on('pageerror', (e) => check('no page errors', false, e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('   console.error:', m.text()) })
  await fakeApi(page, opts)
  return page
}

async function startGame(page) {
  await page.goto(APP + '/')
  await page.locator('.difficulty-card').nth(1).click()
  await page.getByRole('button', { name: /start/i }).click()
  await page.waitForSelector('#answer')
}

const mm = async (page, label) => console.log('   media', label, await page.evaluate(() => matchMedia('(pointer: coarse)').matches))
const shot = (page, name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true })

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
try {
  for (const mobile of [true, false]) {
    const tag = mobile ? 'phone' : 'desktop'
    const page = await newPage(browser, { mobile })
    await startGame(page)
    // A: problem screen
    const input = page.locator('#answer')
    check(`${tag} A full keyboard`, (await input.getAttribute('inputmode')) === 'text')
    check(`${tag} A points chip`, (await page.locator('[data-test="points-chip"]').textContent()).trim() === '⭐ 10 pts')
    check(`${tag} A format tip`, (await page.locator('[data-test="format-tip"]').textContent()).trim() === 'Tip: type it like 3/4 or 1 1/2')
    check(`${tag} A hint label`, (await page.locator('[data-test="hint-button"]').textContent()).trim() === '💡 Hint −5 pts · 2 left')
    const qSize = await page.locator('.problem-question').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    check(`${tag} A question ≥1.5rem`, qSize >= 24, `${qSize}px`)
    check(`${tag} no horizontal scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await shot(page, `${tag}-A-problem`)

    // B: hint
    await page.locator('[data-test="hint-button"]').click()
    await page.waitForSelector('.hint-item')
    check(`${tag} B hint announced`, (await page.locator('[data-test="announcer"]').textContent()).startsWith('Hint 1:'))
    check(`${tag} B focus back on input`, await page.evaluate(() => document.activeElement?.id === 'answer'))
    const penalty = await page.locator('.hint-penalty').evaluate((el) => getComputedStyle(el).color)
    check(`${tag} B penalty colour`, penalty === 'rgb(167, 29, 42)', penalty)
    await shot(page, `${tag}-B-hint`)

    // C: correct (with the hint: 5 pts), then a second correct for the streak
    await input.fill('3/4')
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-test="feedback"]')
    check(`${tag} C counter stays on answered problem`, (await page.locator('[data-test="problem-number"]').textContent()).trim() === 'Problem 1 of 4')
    check(`${tag} C feedback focused`, await page.evaluate(() => document.activeElement?.dataset.test === 'feedback'))
    const hintTextVisible = await page.locator('.feedback-card .hint-text').evaluate((el) => getComputedStyle(el).display !== 'none')
    if (!mobile) check('desktop H Enter hint shown with mouse', hintTextVisible)
    await page.keyboard.press('Enter')
    await page.waitForSelector('#answer')
    check(`${tag} C next problem after Enter`, (await page.locator('[data-test="problem-number"]').textContent()).trim() === 'Problem 2 of 4')
    await input.fill('42')
    await page.locator('[data-test="submit"]').click()
    await page.waitForSelector('[data-test="feedback-streak"]')
    check(`${tag} C streak`, (await page.locator('[data-test="header-streak"]').textContent()).trim() === '🔥 2')
    check(`${tag} C announcer`, /^(Correct!|Nailed it!|Great job!|You got it!) \+\d+ points$/.test(await page.locator('[data-test="announcer"]').textContent()))
    await shot(page, `${tag}-C-correct-streak`)
    await page.locator('[data-test="next"]').click()

    // D: wrong + Show me how
    await page.waitForSelector('#answer')
    await input.fill('7')
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-test="you-said"]')
    check(`${tag} D echo`, (await page.locator('[data-test="you-said"]').textContent()) === '7')
    await page.locator('[data-test="show-me-how"]').focus()
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-test="explanation"]')
    check(`${tag} D Enter on Show me how didn't skip`, await page.locator('[data-test="feedback"]').isVisible())
    check(`${tag} D focus on explanation`, await page.evaluate(() => document.activeElement?.dataset.test === 'explanation'))
    await shot(page, `${tag}-D-wrong-explained`)

    // Keyboard focus ring on Next
    await page.keyboard.press('Tab')
    await page.waitForTimeout(400) // .btn transitions all properties over 0.3s
    const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}` })
    check(`${tag} focus ring visible`, ring === 'solid 3px rgb(76, 81, 191)', ring)
    await shot(page, `${tag}-H-focus-ring`)

    // E: exit dialog, Keep playing, then browser Back, then Leave
    await page.locator('[data-test="exit"]').click()
    await page.waitForSelector('dialog[open]')
    const box = await page.locator('dialog[open]').boundingBox()
    const vw = page.viewportSize().width, vh = page.viewportSize().height
    check(`${tag} E dialog centred`, Math.abs(box.x + box.width / 2 - vw / 2) <= 2 && Math.abs(box.y + box.height / 2 - vh / 2) <= 2, `x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)}`)
    await page.screenshot({ path: `${SHOTS}${tag}-E-exit-dialog-viewport.png` })
    check(`${tag} E Keep playing focused`, await page.evaluate(() => document.activeElement?.dataset.test === 'keep-playing'))
    await shot(page, `${tag}-E-exit-dialog`)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    // A person can't press Back within milliseconds of Escape; Chrome's
    // close-watcher rules can swallow a dialog opened in that window (the
    // navigation still stays cancelled), so let the close settle first
    await page.waitForTimeout(300)
    check(`${tag} E Escape stays in game`, new URL(page.url()).pathname === '/game')
    await page.goBack()
    await page.waitForSelector('dialog[open]', { timeout: 3000 })
    check(`${tag} E browser Back asks first`, new URL(page.url()).pathname === '/game')
    await page.locator('[data-test="leave"]').click()
    await page.waitForSelector('.resume-card')
    check(`${tag} F Home offers Continue`, true)
    await shot(page, `${tag}-F-home-continue`)
    await page.locator('.resume-card .btn-primary').click()
    await page.waitForSelector('#answer')
    check(`${tag} F Continue shows next problem`, (await page.locator('[data-test="problem-number"]').textContent()).trim() === 'Problem 4 of 4')
    check(`${tag} F text tip`, (await page.locator('[data-test="format-tip"]').textContent()).trim() === 'Tip: a word or short phrase')
    await page.context().close()
  }

  // B': resumed from the server with 2 hints used on the current problem
  {
    const page = await newPage(browser, {
      mobile: true,
      serverSessions: [{ sessionId: 's1', difficulty: 'middle', startTime: new Date().toISOString(), isCompleted: false, problemCount: 4, correctCount: 0 }],
      resumeSession: freshSession({ hintsRequested: { p1: 2 } })
    })
    await page.goto(APP + '/')
    await page.locator('.resume-card .btn-primary').click()
    await page.waitForSelector('#answer')
    check('phone B resumed hints line', (await page.locator('[data-test="used-hints"]').textContent()).trim() === 'You already used 2 hints on this problem (−10 pts).')
    check('phone B resumed hint button', (await page.locator('[data-test="hint-button"]').textContent()).trim() === '💡 Hint −5 pts · 0 left')
    await shot(page, 'phone-B2-resumed-hints')
    await page.context().close()
  }

  // D': explanation fails
  {
    const page = await newPage(browser, { mobile: true, explanationFails: true })
    await startGame(page)
    await page.locator('#answer').fill('1/2')
    await page.keyboard.press('Enter')
    await page.locator('[data-test="show-me-how"]').click()
    await page.waitForSelector('[data-test="explanation-retry"]')
    check('phone D explanation failure offers retry', (await page.locator('.explanation-error').textContent()).includes("Couldn't load the explanation."))
    check('phone D focus on Try again', await page.evaluate(() => document.activeElement?.dataset.test === 'explanation-retry'))
    await shot(page, 'phone-D2-explanation-error')
    await page.context().close()
  }

  // Touch: full-page screenshots of tall pages drop Playwright's touch
  // emulation, so this runs in a fresh phone context without screenshots
  {
    const page = await newPage(browser, { mobile: true })
    await startGame(page)
    await page.locator('#answer').fill('3/4')
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-test="feedback"]')
    const media = await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches)
    const display = await page.locator('.feedback-card .hint-text').evaluate((el) => getComputedStyle(el).display)
    check('phone H Enter hint hidden on touch', media && display === 'none', `coarse=${media} display=${display}`)
    await page.context().close()
  }

  // Reduced motion
  {
    const page = await newPage(browser, { mobile: false, reducedMotion: 'reduce' })
    await startGame(page)
    const t = await page.locator('[data-test="submit"]').evaluate((el) => getComputedStyle(el).transitionDuration)
    check('reduced motion: transitions off', parseFloat(t) <= 0.0001, t)
    await page.context().close()
  }
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
