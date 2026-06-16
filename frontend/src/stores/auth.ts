import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@/types'
import { authService } from '@/services/auth'
import { useLoadingState } from '@/composables/useLoadingState'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const { isLoading, error, withLoading } = useLoadingState()

  async function register(email: string, password: string, ageGroup: string) {
    // Don't set user/isAuthenticated yet - they need to verify email first
    return withLoading(
      () => authService.register(email, password, ageGroup),
      'Registration failed'
    )
  }

  async function confirmEmail(email: string, code: string, password: string, ageGroup: string) {
    return withLoading(async () => {
      const result = await authService.confirmEmail(email, code, password, ageGroup)
      user.value = result.user
      isAuthenticated.value = true
      return result
    }, 'Email verification failed')
  }

  async function resendConfirmationCode(email: string) {
    return withLoading(
      () => authService.resendConfirmationCode(email),
      'Failed to resend code'
    )
  }

  async function forgotPassword(email: string) {
    return withLoading(
      () => authService.forgotPassword(email),
      'Failed to send password reset code'
    )
  }

  async function confirmPasswordReset(email: string, code: string, newPassword: string) {
    return withLoading(
      () => authService.confirmPasswordReset(email, code, newPassword),
      'Failed to reset password'
    )
  }

  async function login(email: string, password: string) {
    return withLoading(async () => {
      const result = await authService.login(email, password)
      user.value = result.user
      isAuthenticated.value = true
      return result
    }, 'Login failed')
  }

  async function logout() {
    try {
      await authService.logout()
      user.value = null
      isAuthenticated.value = false
    } catch (err: any) {
      error.value = err.message || 'Logout failed'
      throw err
    }
  }

  async function checkAuth() {
    isLoading.value = true
    try {
      const currentUser = await authService.getCurrentUser()
      if (currentUser) {
        user.value = currentUser
        isAuthenticated.value = true
      }
    } catch (err) {
      user.value = null
      isAuthenticated.value = false
    } finally {
      isLoading.value = false
    }
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    register,
    confirmEmail,
    resendConfirmationCode,
    forgotPassword,
    confirmPasswordReset,
    login,
    logout,
    checkAuth
  }
})
