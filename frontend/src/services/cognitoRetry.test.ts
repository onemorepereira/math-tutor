import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CognitoRefreshToken, CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js'
import { failFastOnServiceErrors } from './cognitoRetry'

// These tests drive the real amazon-cognito-identity-js retry loop with only
// fetch stubbed, so a library upgrade that bypasses the hook fails here

const USERNAME = 'kid@example.com'

function serviceError(type: string, status: number) {
  return new Response(JSON.stringify({ __type: type, message: type }), {
    status,
    headers: { 'Content-Type': 'application/x-amz-json-1.1' }
  })
}

function tokenResponse() {
  // Unsigned JWT-shaped tokens are enough: the library only base64-decodes the payload
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const jwt = (payload: object) => `${b64({ alg: 'none' })}.${b64(payload)}.sig`
  const now = Math.floor(Date.now() / 1000)
  return new Response(JSON.stringify({
    AuthenticationResult: {
      IdToken: jwt({ exp: now + 3600, iat: now }),
      AccessToken: jwt({ exp: now + 3600, iat: now }),
      TokenType: 'Bearer'
    }
  }), { status: 200 })
}

function refresh(pool: CognitoUserPool) {
  const user = new CognitoUser({ Username: USERNAME, Pool: pool })
  return new Promise<{ err: any, session: any }>((resolve) => {
    user.refreshSession(new CognitoRefreshToken({ RefreshToken: 'stale' }), (err, session) => {
      resolve({ err, session })
    })
  })
}

function newPool(patched: boolean) {
  const pool = new CognitoUserPool({ UserPoolId: 'us-east-1_test', ClientId: 'testclient' })
  if (patched) failFastOnServiceErrors(pool)
  return pool
}

describe('failFastOnServiceErrors', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('makes one request when Cognito rejects the refresh token', async () => {
    fetchMock.mockImplementation(async () => serviceError('NotAuthorizedException', 400))

    const pool = newPool(true)
    const storage = (pool as any).storage as Storage
    const tokenKey = `CognitoIdentityServiceProvider.testclient.${USERNAME}.refreshToken`
    storage.setItem(tokenKey, 'stale')
    expect(storage.getItem(tokenKey)).toBe('stale')

    const { err } = await refresh(pool)

    expect(err.code).toBe('NotAuthorizedException')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // The library still drops the dead login, so the next load doesn't retry it
    expect(storage.getItem(tokenKey)).toBeFalsy()
  })

  it('does not retry other final rejections either', async () => {
    fetchMock.mockImplementation(async () => serviceError('UserNotFoundException', 400))

    const { err } = await refresh(newPool(true))

    expect(err.code).toBe('UserNotFoundException')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['throttling', async () => serviceError('TooManyRequestsException', 400)],
    ['a Cognito-side failure', async () => serviceError('InternalErrorException', 500)]
  ])('still retries %s, then succeeds', async (_label, failure) => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce(failure).mockImplementation(async () => tokenResponse())

    const pending = refresh(newPool(true))
    await vi.runAllTimersAsync()
    const { err, session } = await pending

    expect(err).toBeNull()
    expect(session.isValid()).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('leaves a successful refresh unchanged', async () => {
    fetchMock.mockImplementation(async () => tokenResponse())

    const { err, session } = await refresh(newPool(true))

    expect(err).toBeNull()
    expect(session.getRefreshToken().getToken()).toBe('stale')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never breaks sign-in when the library internals change', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => failFastOnServiceErrors({} as CognitoUserPool)).not.toThrow()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('is needed: the unpatched library retries a rejection five more times', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(async () => serviceError('NotAuthorizedException', 400))

    const pending = refresh(newPool(false))
    await vi.runAllTimersAsync()
    const { err } = await pending

    expect(err.code).toBe('NotAuthorizedException')
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })
})
