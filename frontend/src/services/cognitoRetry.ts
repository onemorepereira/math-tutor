import type { CognitoUserPool } from 'amazon-cognito-identity-js'

/**
 * amazon-cognito-identity-js retries every failed session refresh with backoff
 * (6 requests over ~6 s, `es/Client.js` "For now, all errors are retryable"),
 * even when Cognito has given a final answer such as NotAuthorizedException
 * for an expired or revoked refresh token. The router waits on that refresh
 * before rendering, so a returning player with a stale login saw a blank page.
 *
 * The retry loop already stops on errors flagged `nonRetryable`. This marks
 * every Cognito service error as non-retryable except the transient ones, so a
 * rejection fails on the first request while network blips, throttling and
 * Cognito-side failures still get the library's backoff.
 *
 * It hooks `pool.client.request`, which is not a public API. Pin the library
 * version; `cognitoRetry.test.ts` drives the real retry loop and fails if an
 * upgrade bypasses the hook.
 */

const RETRYABLE_CODES = new Set([
  'NetworkError',
  'TooManyRequestsException',
  'InternalErrorException'
])

type RequestCallback = (err: any, data?: any) => void

interface CognitoClient {
  request(operation: string, params: object, callback: RequestCallback): void
}

export function failFastOnServiceErrors(pool: CognitoUserPool) {
  const client = (pool as unknown as { client?: CognitoClient }).client
  if (typeof client?.request !== 'function') {
    // Never break sign-in over this: fall back to the library's own retries
    console.warn('Cognito client internals changed; rejected refreshes will be retried')
    return
  }
  const request = client.request.bind(client)

  client.request = (operation, params, callback) => {
    request(operation, params, (err, data) => {
      if (err?.code && !RETRYABLE_CODES.has(err.code)) {
        err.nonRetryable = true
      }
      callback(err, data)
    })
  }
}
