<template>
  <div class="verify-email-view">
    <div class="auth-card card">
      <h2>Verify Your Email</h2>
      <p class="subtitle">
        We've sent a verification code to <strong>{{ email }}</strong>
      </p>

      <div v-if="error" class="error-message">{{ error }}</div>
      <div v-if="successMessage" class="success-message">{{ successMessage }}</div>

      <form @submit.prevent="handleVerify">
        <div class="form-group">
          <label for="code">Verification Code</label>
          <input
            id="code"
            v-model="code"
            type="text"
            required
            placeholder="Enter 6-digit code"
            maxlength="6"
            pattern="[0-9]{6}"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="isLoading">
          {{ isLoading ? 'Verifying...' : 'Verify Email' }}
        </button>
      </form>

      <div class="resend-section">
        <p>Didn't receive the code?</p>
        <button
          type="button"
          class="btn-link"
          @click="handleResend"
          :disabled="isResending || cooldownActive"
        >
          {{ isResending ? 'Sending...' : cooldownActive ? `Resend (${cooldownSeconds}s)` : 'Resend Code' }}
        </button>
      </div>

      <p class="auth-link">
        <router-link to="/login">Back to Login</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCooldown } from '@/composables/useCooldown'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const ageGroup = ref('')
const password = ref('')
const code = ref('')
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const isLoading = ref(false)
const isResending = ref(false)
const { cooldownActive, cooldownSeconds, startCooldown } = useCooldown(60)

onMounted(() => {
  email.value = route.query.email as string || ''
  ageGroup.value = route.query.ageGroup as string || ''
  // Held in memory only; empty after a refresh, in which case verification
  // still works but finishes on the login page instead of auto-logging in
  password.value = authStore.pendingPassword || ''

  if (!email.value || !ageGroup.value) {
    router.push({ name: 'register' })
  }
})

async function handleVerify() {
  error.value = null
  successMessage.value = null

  if (code.value.length !== 6) {
    error.value = 'Please enter a valid 6-digit code'
    return
  }

  try {
    isLoading.value = true
    if (password.value) {
      await authStore.confirmEmail(email.value, code.value, password.value, ageGroup.value)
      authStore.clearPendingPassword()
      router.push({ name: 'home' })
    } else {
      await authStore.confirmEmailOnly(email.value, code.value)
      router.push({ name: 'login', query: { verified: '1' } })
    }
  } catch (err: any) {
    if (err.message?.includes('Code mismatch') || err.message?.includes('Invalid')) {
      error.value = 'Invalid verification code. Please try again.'
    } else if (err.message?.includes('expired')) {
      error.value = 'Verification code has expired. Please request a new one.'
    } else {
      error.value = err.message || 'Email verification failed. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}

async function handleResend() {
  error.value = null
  successMessage.value = null

  try {
    isResending.value = true
    await authStore.resendConfirmationCode(email.value)
    successMessage.value = 'Verification code sent! Check your email.'

    // Start 60-second cooldown
    startCooldown()
  } catch (err: any) {
    error.value = err.message || 'Failed to resend code. Please try again.'
  } finally {
    isResending.value = false
  }
}
</script>

<style scoped>
.verify-email-view {
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

.subtitle strong {
  color: #333;
}

.btn-block {
  width: 100%;
}

.resend-section {
  text-align: center;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e9ecef;
}

.resend-section p {
  color: #6c757d;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  padding: 0.5rem 1rem;
  transition: color 0.2s;
}

.btn-link:hover:not(:disabled) {
  color: #5568d3;
  text-decoration: underline;
}

.btn-link:disabled {
  color: #adb5bd;
  cursor: not-allowed;
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

.success-message {
  background-color: #d4edda;
  color: #155724;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid #c3e6cb;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .verify-email-view {
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

  .resend-section {
    margin-top: 1rem;
    padding-top: 1rem;
  }

  .auth-link {
    margin-top: 1rem;
    font-size: 0.9rem;
  }
}

@media (max-width: 380px) {
  .verify-email-view {
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
