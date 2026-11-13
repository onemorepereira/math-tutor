// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'
import type { GameSession } from '@/types'

// Network boundary only
vi.mock('@/services/auth', () => ({
  authService: { getCurrentUser: vi.fn(), getUserStats: vi.fn(), logout: vi.fn() }
}))
vi.mock('@/services/game', () => ({
  gameService: { getGameSession: vi.fn(), createGameSession: vi.fn() }
}))

import { authService } from '@/services/auth'
import { gameService } from '@/services/game'
import { useAuthStore } from '@/stores/auth'
import { useGameStore } from '@/stores/game'
import HomeView from './HomeView.vue'

const Stub = (name: string) => defineComponent({ name, render: () => h('div', name) })

function session(over: Partial<GameSession> = {}): GameSession {
  return {
    sessionId: 'mem-1',
    userId: 'u1',
    difficulty: 'middle',
    problems: [{ id: 'a' }, { id: 'b' }],
    attempts: [{ problemId: 'a', isCorrect: true }],
    currentProblemIndex: 1,
    totalScore: 10,
    totalTimeSeconds: 5,
    startTime: new Date().toISOString(),
    isCompleted: false,
    ...over
  } as unknown as GameSession
}

let router: Router

async function mountHome() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomeView },
      { path: '/game', name: 'game', component: Stub('game') },
      { path: '/scorecard', name: 'scorecard', component: Stub('scorecard') }
    ]
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [router], stubs: { Leaderboard: true, ActivityCalendar: true, GameLoadingOverlay: true } }
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.isAuthenticated = true
  auth.user = { userId: 'u1', screenName: 'Kid', ageGroup: 'middle', totalScore: 10, gamesPlayed: 1 } as any
  vi.mocked(authService.getCurrentUser).mockResolvedValue(auth.user)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('HomeView — continue', () => {
  it('offers to continue an unfinished game still in memory, without a reload', async () => {
    useGameStore().currentSession = session()
    const wrapper = await mountHome()

    expect(wrapper.find('.resume-card').exists()).toBe(true)
    expect(authService.getUserStats).not.toHaveBeenCalled()

    await wrapper.get('.resume-card .btn-primary').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('game')
    expect(gameService.getGameSession).not.toHaveBeenCalled()
  })

  it('looks up the server when the game in memory is already finished', async () => {
    useGameStore().currentSession = session({ isCompleted: true })
    vi.mocked(authService.getUserStats).mockResolvedValue({
      sessions: [{ sessionId: 'srv-1', difficulty: 'high', startTime: new Date().toISOString(), isCompleted: false, problemCount: 10, correctCount: 2 }]
    })

    const wrapper = await mountHome()

    expect(authService.getUserStats).toHaveBeenCalledOnce()
    expect(wrapper.get('.resume-card').text()).toContain('High School')
  })
})
