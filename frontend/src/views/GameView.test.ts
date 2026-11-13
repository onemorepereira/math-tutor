// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'
import type { GameSession, MathProblem } from '@/types'

// Only the network boundary is faked; the store, router, dialog and
// explanation components are the real ones
vi.mock('@/services/game', () => ({
  gameService: {
    submitAnswer: vi.fn(),
    requestHint: vi.fn(),
    getSolutionExplanation: vi.fn(),
    endGameSession: vi.fn(),
    getGameSession: vi.fn(),
    createGameSession: vi.fn()
  }
}))

import { gameService } from '@/services/game'
import { useGameStore } from '@/stores/game'
import GameView from './GameView.vue'

const service = vi.mocked(gameService)
const Stub = (name: string) => defineComponent({ name, render: () => h('div', name) })

const proto = HTMLDialogElement.prototype as any
const originalDialog = { showModal: proto.showModal, close: proto.close }

function problem(id: string, over: Partial<MathProblem> = {}): MathProblem {
  return { id, question: `Question ${id}`, correctAnswer: '3/4', difficulty: 'middle', topic: 'Fractions', maxPoints: 10, answerType: 'numeric', ...over }
}

function session(problems: MathProblem[]): GameSession {
  return {
    sessionId: 's1',
    userId: 'u1',
    difficulty: 'middle',
    problems,
    attempts: [],
    currentProblemIndex: 0,
    totalScore: 0,
    totalTimeSeconds: 0,
    startTime: new Date().toISOString(),
    isCompleted: false
  } as unknown as GameSession
}

let router: Router
let store: ReturnType<typeof useGameStore>

async function startGame(problems = [problem('a'), problem('b'), problem('c')]) {
  store.currentSession = session(problems)
  await store.loadNextProblem()
}

async function mountGame(): Promise<VueWrapper> {
  await router.push('/game')
  await router.isReady()
  // Rendered through RouterView, as App.vue does: route-leave guards only
  // register for components the router itself rendered
  const wrapper = mount(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

async function answer(wrapper: VueWrapper, text: string, result: { isCorrect: boolean; pointsEarned: number; correctAnswer: string }) {
  service.submitAnswer.mockResolvedValueOnce(result)
  await wrapper.get('#answer').setValue(text)
  await wrapper.get('[data-test="submit"]').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  store = useGameStore()
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub('home') },
      { path: '/game', name: 'game', component: GameView },
      { path: '/scorecard', name: 'scorecard', component: Stub('scorecard') },
      { path: '/login', name: 'login', component: Stub('login') }
    ]
  })
  proto.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
  proto.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  })
})

afterEach(() => {
  proto.showModal = originalDialog.showModal
  proto.close = originalDialog.close
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('GameView — answering', () => {
  it('asks for the full keyboard and explains the answer format', async () => {
    await startGame()
    const wrapper = await mountGame()
    const input = wrapper.get('#answer')

    expect(input.attributes()).toMatchObject({ inputmode: 'text', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' })
    expect(wrapper.get('[data-test="format-tip"]').text()).toBe('Tip: type it like 3/4 or 1 1/2')
  })

  it('shows what the problem is worth and what a hint costs', async () => {
    await startGame()
    const wrapper = await mountGame()

    expect(wrapper.get('[data-test="points-chip"]').text()).toBe('⭐ 10 pts')
    expect(wrapper.get('[data-test="hint-button"]').text()).toBe('💡 Hint −5 pts · 2 left')
  })

  it('announces a hint and counts it down', async () => {
    await startGame()
    const wrapper = await mountGame()
    service.requestHint.mockResolvedValueOnce({ hintNumber: 1, content: 'Add the tops', pointDeduction: 5 } as any)

    await wrapper.get('[data-test="hint-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="announcer"]').text()).toBe('Hint 1: Add the tops')
    expect(wrapper.get('[data-test="hint-button"]').text()).toBe('💡 Hint −5 pts · 1 left')
  })

  it('says how many hints a resumed problem already used', async () => {
    await startGame()
    store.hintsUsedCount = 2
    const wrapper = await mountGame()

    expect(wrapper.get('[data-test="used-hints"]').text()).toBe('You already used 2 hints on this problem (−10 pts).')
  })
})

describe('GameView — feedback', () => {
  it('praises a correct answer, keeps the counter on the answered problem and announces it', async () => {
    await startGame()
    const wrapper = await mountGame()
    const announcer = wrapper.get('[data-test="announcer"]')
    expect(announcer.text()).toBe('')

    await answer(wrapper, '3/4', { isCorrect: true, pointsEarned: 10, correctAnswer: '3/4' })

    expect(wrapper.get('[data-test="feedback"]').text()).toContain('Correct!')
    expect(wrapper.get('[data-test="feedback"]').text()).toContain('+10 points')
    expect(wrapper.get('[data-test="problem-number"]').text()).toBe('Problem 1 of 3')
    expect(wrapper.get('[data-test="progress-fill"]').attributes('style')).toContain('width: 33.3')
    // The same, always-mounted live region carries the result
    expect(wrapper.get('[data-test="announcer"]').element).toBe(announcer.element)
    expect(announcer.text()).toBe('Correct! +10 points')
  })

  it('shows a streak from two correct answers in a row, with varied praise', async () => {
    await startGame()
    const wrapper = await mountGame()

    await answer(wrapper, '3/4', { isCorrect: true, pointsEarned: 10, correctAnswer: '3/4' })
    expect(wrapper.find('[data-test="header-streak"]').exists()).toBe(false)
    await wrapper.get('[data-test="next"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="problem-number"]').text()).toBe('Problem 2 of 3')
    expect(wrapper.get('[data-test="announcer"]').text()).toBe('')

    await answer(wrapper, '3/4', { isCorrect: true, pointsEarned: 10, correctAnswer: '3/4' })
    expect(wrapper.get('[data-test="feedback"]').text()).toContain('Nailed it!')
    expect(wrapper.get('[data-test="feedback-streak"]').text()).toBe('· 🔥 2 in a row')
    expect(wrapper.get('[data-test="header-streak"]').text()).toBe('🔥 2')
  })

  it('encourages a correct answer whose points went to hints', async () => {
    await startGame()
    const wrapper = await mountGame()
    await answer(wrapper, '3/4', { isCorrect: true, pointsEarned: 0, correctAnswer: '3/4' })

    expect(wrapper.get('[data-test="feedback"]').text()).toContain("The hints used up this one's points, but you solved it 💪")
  })

  it('shows the typed answer next to the right one, with Show me how', async () => {
    await startGame()
    const wrapper = await mountGame()
    await answer(wrapper, '12/4', { isCorrect: false, pointsEarned: 0, correctAnswer: '3/4' })

    expect(wrapper.get('[data-test="you-said"]').text()).toBe('12/4')
    expect(wrapper.get('[data-test="right-answer"]').text()).toBe('3/4')
    expect(wrapper.get('[data-test="announcer"]').text()).toBe('Not quite right. The answer is 3/4.')

    service.getSolutionExplanation.mockResolvedValueOnce({ problemId: 'a', explanation: 'Add the tops', steps: ['Keep the 4'], ageAppropriateInsight: '' })
    await wrapper.get('[data-test="show-me-how"]').trigger('click')
    await flushPromises()
    expect(service.getSolutionExplanation).toHaveBeenCalledWith('s1', 'a')
    expect(wrapper.get('[data-test="explanation"]').text()).toContain('Keep the 4')
  })

  it('does not skip ahead when Enter is pressed on Show me how', async () => {
    await startGame()
    const wrapper = await mountGame()
    await answer(wrapper, '12/4', { isCorrect: false, pointsEarned: 0, correctAnswer: '3/4' })

    await wrapper.get('[data-test="show-me-how"]').trigger('keyup', { key: 'Enter' })
    expect(wrapper.find('[data-test="feedback"]').exists()).toBe(true)

    // Enter on the card itself still advances
    await wrapper.get('[data-test="feedback"]').trigger('keyup', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.find('[data-test="feedback"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="problem-number"]').text()).toBe('Problem 2 of 3')
  })
})

describe('GameView — leaving and resuming', () => {
  it('asks before Exit leaves an unfinished game, and stays on Keep playing', async () => {
    await startGame()
    const wrapper = await mountGame()

    await wrapper.get('[data-test="exit"]').trigger('click')
    await flushPromises()
    expect(proto.showModal).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.name).toBe('game')

    await wrapper.get('[data-test="keep-playing"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('game')
    expect(document.activeElement).toBe(wrapper.get('#answer').element)
  })

  it('leaves after confirming, replacing the game in history', async () => {
    await startGame()
    const wrapper = await mountGame()
    const replace = vi.spyOn(router, 'replace')

    await router.push('/').catch(() => {})
    await flushPromises()
    await wrapper.get('[data-test="leave"]').trigger('click')
    await flushPromises()

    expect(replace).toHaveBeenCalledWith('/')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('never blocks the scorecard, login, or a game that was reset', async () => {
    await startGame()
    await mountGame()
    await router.push('/scorecard')
    expect(router.currentRoute.value.name).toBe('scorecard')

    await startGame()
    await router.push('/game')
    await flushPromises()
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('login')

    await startGame()
    await router.push('/game')
    await flushPromises()
    store.resetGame()
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('home')
    expect(proto.showModal).not.toHaveBeenCalled()
  })

  it('continues with the next problem when the player left during feedback', async () => {
    await startGame()
    const first = await mountGame()
    await answer(first, '3/4', { isCorrect: true, pointsEarned: 10, correctAnswer: '3/4' })
    // Leave with feedback showing (confirming the dialog), then come back
    await first.get('[data-test="exit"]').trigger('click')
    await flushPromises()
    await first.get('[data-test="leave"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('home')

    await router.push('/game')
    await flushPromises()
    const wrapper = first
    expect(wrapper.get('.problem-question').text()).toBe('Question b')
    expect(wrapper.get('[data-test="problem-number"]').text()).toBe('Problem 2 of 3')
    expect(wrapper.find('[data-test="feedback"]').exists()).toBe(false)
  })

  it('offers a way home when the game cannot be shown', async () => {
    store.currentSession = session([problem('a')])
    const wrapper = await mountGame()

    expect(wrapper.get('[data-test="load-failure"]').text()).toContain("We couldn't load your game.")
    await wrapper.get('[data-test="load-failure"] button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('home')
    expect(proto.showModal).not.toHaveBeenCalled()
  })
})
