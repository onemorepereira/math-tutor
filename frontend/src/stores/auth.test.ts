import { beforeEach, expect, test, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/auth', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    logout: vi.fn()
  }
}))

import { authService } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'
import { useGameStore } from '@/stores/game'

const player = { id: 'user-1', screenName: 'CleverFox42', ageGroup: 'elementary', totalScore: 100, gamesPlayed: 2 }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(authService.getCurrentUser).mockReset()
  vi.mocked(authService.logout).mockReset()
})

test('restores a stored Cognito session once, however many navigations ask', async () => {
  vi.mocked(authService.getCurrentUser).mockResolvedValue(player as any)
  const auth = useAuthStore()

  await Promise.all([auth.ensureAuthChecked(), auth.ensureAuthChecked()])
  await auth.ensureAuthChecked()

  expect(auth.isAuthenticated).toBe(true)
  expect(auth.user?.screenName).toBe('CleverFox42')
  expect(authService.getCurrentUser).toHaveBeenCalledTimes(1)
})

test('logging out clears the previous player\'s game', async () => {
  const auth = useAuthStore()
  const game = useGameStore()
  game.scorecard = { sessionId: 's-1', totalScore: 50 } as any

  await auth.logout()

  expect(auth.isAuthenticated).toBe(false)
  expect(game.scorecard).toBeNull()
  expect(game.currentSession).toBeNull()
})

test('refreshUser picks up the score credited by a finished game', async () => {
  vi.mocked(authService.getCurrentUser).mockResolvedValue({ ...player, totalScore: 160 } as any)
  const auth = useAuthStore()
  auth.user = player as any
  auth.isAuthenticated = true

  await auth.refreshUser()

  expect(auth.user?.totalScore).toBe(160)
})

test('refreshUser keeps the current profile when the refresh fails', async () => {
  vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('offline'))
  const auth = useAuthStore()
  auth.user = player as any
  auth.isAuthenticated = true

  await auth.refreshUser()

  expect(auth.user?.totalScore).toBe(100)
  expect(auth.isAuthenticated).toBe(true)
})
