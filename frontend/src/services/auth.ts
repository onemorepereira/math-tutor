import axios from 'axios'
import type { User } from '@/types'
import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserSession,
  AuthenticationDetails,
  CognitoUserAttribute
} from 'amazon-cognito-identity-js'

interface AuthSession {
  session: CognitoUserSession
  user: User
}

interface RegisterResult {
  cognitoUser: CognitoUser
  userConfirmed: boolean
  email: string
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || ''
}

const userPool = new CognitoUserPool(poolData)

/**
 * Fetch the user's profile, creating it if it doesn't exist yet (the register
 * endpoint is idempotent and derives identity from the verified JWT). This makes
 * login self-healing when verification finished without completing registration.
 */
async function fetchOrCreateProfile(session: CognitoUserSession): Promise<User> {
  const headers = { Authorization: `Bearer ${session.getIdToken().getJwtToken()}` }

  try {
    const response = await axios.get(`${API_URL}/api/users/profile`, { headers })
    return response.data.user
  } catch (err: any) {
    if (err?.response?.status !== 404) {
      throw err
    }
    const ageGroup = (session.getIdToken().payload['custom:ageGroup'] as string) || 'elementary'
    const response = await axios.post(`${API_URL}/api/users/register`, { ageGroup }, { headers })
    return response.data.user
  }
}

export const authService = {
  async register(email: string, password: string, ageGroup: string) {
    return new Promise<RegisterResult>((resolve, reject) => {
      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: email
        }),
        new CognitoUserAttribute({
          Name: 'custom:ageGroup',
          Value: ageGroup
        })
      ]

      userPool.signUp(email, password, attributeList, [], async (err, result) => {
        if (err || !result) {
          reject(err ?? new Error('Registration failed: no result returned'))
          return
        }

        // Just return the Cognito user - don't create in DynamoDB yet
        // That will happen after email verification
        resolve({
          cognitoUser: result.user,
          userConfirmed: result.userConfirmed,
          email
        })
      })
    })
  },

  async confirmEmail(email: string, code: string, password: string, ageGroup: string) {
    return new Promise<AuthSession>((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      })

      cognitoUser.confirmRegistration(code, true, async (err) => {
        if (err) {
          reject(err)
          return
        }

        // After successful confirmation, authenticate the user to get a session
        try {
          const authenticationDetails = new AuthenticationDetails({
            Username: email,
            Password: password
          })

          cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: async (session) => {
              try {
                const idToken = session.getIdToken().getJwtToken()

                // Create user in DynamoDB; identity comes from the verified JWT
                const response = await axios.post(`${API_URL}/api/users/register`, {
                  ageGroup
                }, {
                  headers: {
                    Authorization: `Bearer ${idToken}`
                  }
                })

                resolve({
                  session,
                  user: response.data.user
                })
              } catch (apiErr) {
                reject(apiErr)
              }
            },
            onFailure: (authErr) => {
              reject(authErr)
            }
          })
        } catch (authErr) {
          reject(authErr)
        }
      })
    })
  },

  async confirmEmailOnly(email: string, code: string) {
    return new Promise<void>((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      })

      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  },

  async resendConfirmationCode(email: string) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      })

      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          reject(err)
          return
        }
        resolve(result)
      })
    })
  },

  async forgotPassword(email: string) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      })

      cognitoUser.forgotPassword({
        onSuccess: (result) => {
          resolve(result)
        },
        onFailure: (err) => {
          reject(err)
        }
      })
    })
  },

  async confirmPasswordReset(email: string, code: string, newPassword: string) {
    return new Promise<{ success: boolean }>((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      })

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => {
          resolve({ success: true })
        },
        onFailure: (err) => {
          reject(err)
        }
      })
    })
  },

  async login(email: string, password: string) {
    return new Promise<AuthSession>((resolve, reject) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password
      })

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      })

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: async (session) => {
          try {
            resolve({
              session,
              user: await fetchOrCreateProfile(session)
            })
          } catch (err) {
            reject(err)
          }
        },
        onFailure: (err) => {
          reject(err)
        }
      })
    })
  },

  async logout() {
    const cognitoUser = userPool.getCurrentUser()
    if (cognitoUser) {
      cognitoUser.signOut()
    }
  },

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser()

      if (!cognitoUser) {
        resolve(null)
        return
      }

      cognitoUser.getSession(async (err: any, session: any) => {
        if (err) {
          reject(err)
          return
        }

        if (!session.isValid()) {
          resolve(null)
          return
        }

        try {
          const idToken = session.getIdToken().getJwtToken()
          const response = await axios.get(`${API_URL}/api/users/profile`, {
            headers: {
              Authorization: `Bearer ${idToken}`
            }
          })

          resolve(response.data.user)
        } catch (err) {
          reject(err)
        }
      })
    })
  },

  getIdToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const cognitoUser = userPool.getCurrentUser()

      if (!cognitoUser) {
        resolve(null)
        return
      }

      cognitoUser.getSession((err: any, session: any) => {
        if (err || !session.isValid()) {
          resolve(null)
          return
        }

        resolve(session.getIdToken().getJwtToken())
      })
    })
  },

  async getUserStats() {
    const token = await this.getIdToken()
    if (!token) throw new Error('Not authenticated')

    const response = await axios.get(`${API_URL}/api/users/sessions`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    return response.data
  }
}
