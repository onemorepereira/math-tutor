import { beforeEach, expect, test, vi } from 'vitest'

const fakeSession = {
  isValid: () => true,
  getIdToken: () => ({
    getJwtToken: () => 'jwt-token',
    payload: { sub: 'sub-1', email: 'kid@example.com', 'custom:ageGroup': 'elementary' }
  })
}

const { signUp, authenticateUser } = vi.hoisted(() => ({
  signUp: vi.fn(),
  authenticateUser: vi.fn()
}))

vi.mock('amazon-cognito-identity-js', () => ({
  CognitoUserPool: vi.fn(function () {
    return { signUp, getCurrentUser: () => null }
  }),
  CognitoUser: vi.fn(function () {
    return { authenticateUser }
  }),
  CognitoUserAttribute: vi.fn(function () {
    return {}
  }),
  AuthenticationDetails: vi.fn(function () {
    return {}
  })
}))

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}))

import axios from 'axios'
import { authService } from '@/services/auth'

beforeEach(() => {
  vi.clearAllMocks()
})

test('register rejects when Cognito signUp yields neither an error nor a result', async () => {
  signUp.mockImplementation((_e, _p, _a, _v, callback) => callback(null, undefined))

  await expect(
    authService.register('kid@example.com', 'Password1', 'elementary')
  ).rejects.toThrow()
})

test('login creates the missing user profile and recovers when the profile fetch 404s', async () => {
  authenticateUser.mockImplementation((_details, callbacks) => callbacks.onSuccess(fakeSession))
  vi.mocked(axios.get).mockRejectedValue({ response: { status: 404 } })
  vi.mocked(axios.post).mockResolvedValue({
    data: { user: { id: 'user-1', email: 'kid@example.com', screenName: 'CleverFox42', ageGroup: 'elementary' } }
  })

  const result = await authService.login('kid@example.com', 'Password1')

  expect(result.user.id).toBe('user-1')
  expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining('/api/users/register'),
    expect.objectContaining({ ageGroup: 'elementary' }),
    expect.anything()
  )
})
