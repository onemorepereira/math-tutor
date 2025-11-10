import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@/types'
import { authService } from '@/services/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function register(email: string, password: string, ageGroup: string) {
    isLoading.value = true
    error.value = null

    try {
      const result = await authService.register(email, password, ageGroup)
      // Don't set user/isAuthenticated yet - they need to verify email first
      return result
    } catch (err: any) {
      error.value = err.message || 'Registration failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function confirmEmail(email: string, code: string, password: string, ageGroup: string) {
    isLoading.value = true
    error.value = null

    try {
      const result = await authService.confirmEmail(email, code, password, ageGroup)
      user.value = result.user
      isAuthenticated.value = true
      return result
    } catch (err: any) {
      error.value = err.message || 'Email verification failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function resendConfirmationCode(email: string) {
    isLoading.value = true
    error.value = null

    try {
      await authService.resendConfirmationCode(email)
    } catch (err: any) {
      error.value = err.message || 'Failed to resend code'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function forgotPassword(email: string) {
    isLoading.value = true
    error.value = null

    try {
      await authService.forgotPassword(email)
    } catch (err: any) {
      error.value = err.message || 'Failed to send password reset code'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function confirmPasswordReset(email: string, code: string, newPassword: string) {
    isLoading.value = true
    error.value = null

    try {
      await authService.confirmPasswordReset(email, code, newPassword)
    } catch (err: any) {
      error.value = err.message || 'Failed to reset password'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function login(email: string, password: string) {
    isLoading.value = true
    error.value = null

    try {
      const result = await authService.login(email, password)
      user.value = result.user
      isAuthenticated.value = true
      return result
    } catch (err: any) {
      error.value = err.message || 'Login failed'
      throw err
    } finally {
      isLoading.value = false
    }
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
