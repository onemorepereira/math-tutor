/**
 * Signals that the Cognito session can no longer be refreshed (refresh token
 * expired or revoked). API calls raise SessionExpiredError instead of sending
 * "Bearer null", and the app-level handler signs the player out and sends
 * them to the login page.
 */

export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please log in again.')
    this.name = 'SessionExpiredError'
  }
}

let expiredHandler: (() => void) | null = null

export function onSessionExpired(handler: () => void) {
  expiredHandler = handler
}

export function sessionExpired(): SessionExpiredError {
  expiredHandler?.()
  return new SessionExpiredError()
}
