<template>
  <div class="forgot-password-view">
    <div class="auth-card card">
      <h2>Reset Your Password</h2>
      <p class="subtitle">Enter your email address and we'll send you a verification code</p>

      <div v-if="error" class="error-message">{{ error }}</div>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            placeholder="your@email.com"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="isLoading">
          {{ isLoading ? 'Sending...' : 'Send Reset Code' }}
        </button>
      </form>

      <p class="auth-link">
        Remember your password?
        <router-link to="/login">Back to Login</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)

async function handleSubmit() {
  error.value = null

  try {
    isLoading.value = true
    await authStore.forgotPassword(email.value)
    // Navigate to reset password page with email
    router.push({
      name: 'reset-password',
      query: { email: email.value }
    })
  } catch (err: any) {
    if (err.message?.includes('User does not exist') || err.message?.includes('not found')) {
      error.value = 'No account found with this email address.'
    } else {
      error.value = err.message || 'Failed to send reset code. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.forgot-password-view {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 200px);
  padding: 2rem;
}

.auth-card {
  max-width: 450px;
  width: 100%;
}

.auth-card h2 {
  text-align: center;
  margin-bottom: 0.5rem;
  color: #333;
}

.subtitle {
  text-align: center;
  color: #6c757d;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.btn-block {
  width: 100%;
}

.auth-link {
  text-align: center;
  margin-top: 1.5rem;
  color: #6c757d;
}

.auth-link a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
}

.auth-link a:hover {
  text-decoration: underline;
}
</style>
