import { beforeEach, expect, test, vi } from 'vitest'

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('./auth', () => ({ authService: { getIdToken: vi.fn() } }))

import axios from 'axios'
import { authService } from './auth'
import { gameService } from './game'
import { onSessionExpired, SessionExpiredError } from './session'

beforeEach(() => {
  vi.mocked(axios.post).mockReset()
  vi.mocked(authService.getIdToken).mockReset()
})

test('an unrefreshable session never sends "Bearer null" and signals expiry', async () => {
  vi.mocked(authService.getIdToken).mockResolvedValue(null)
  const expired = vi.fn()
  onSessionExpired(expired)

  await expect(gameService.createGameSession('elementary', 10)).rejects.toBeInstanceOf(SessionExpiredError)

  expect(axios.post).not.toHaveBeenCalled()
  expect(expired).toHaveBeenCalledTimes(1)
})

test('a valid token is sent as a bearer header', async () => {
  vi.mocked(authService.getIdToken).mockResolvedValue('jwt-token')
  vi.mocked(axios.post).mockResolvedValue({ data: { session: { sessionId: 's-1' } } })

  await gameService.createGameSession('elementary', 10)

  expect(vi.mocked(axios.post).mock.calls[0][2]).toEqual({ headers: { Authorization: 'Bearer jwt-token' } })
})
