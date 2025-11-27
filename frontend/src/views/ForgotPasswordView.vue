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

/* Mobile optimizations */
@media (max-width: 768px) {
  .forgot-password-view {
    min-height: calc(100vh - 140px);
    padding: 1rem;
    align-items: flex-start;
    padding-top: 2rem;
  }

  .auth-card {
    padding: 1.5rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .auth-card h2 {
    font-size: 1.5rem;
  }

  .subtitle {
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .form-group input {
    padding: 0.875rem;
    font-size: 16px; /* Prevents zoom on iOS */
  }

  .btn-block {
    padding: 0.875rem;
    font-size: 1rem;
  }

  .auth-link {
    margin-top: 1rem;
    font-size: 0.9rem;
  }
}

@media (max-width: 380px) {
  .forgot-password-view {
    padding: 0.75rem;
    padding-top: 1.5rem;
  }

  .auth-card {
    padding: 1.25rem;
  }

  .auth-card h2 {
    font-size: 1.35rem;
  }
}
</style>
