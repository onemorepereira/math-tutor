<template>
  <div class="register-view">
    <div class="auth-card card">
      <h2>Create Your Account</h2>
      <p class="subtitle">Join Number Ninja and become a math master!</p>

      <div v-if="error" class="error-message">{{ error }}</div>

      <form @submit.prevent="handleRegister">
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

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            minlength="8"
            placeholder="Minimum 8 characters"
          />
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            required
            placeholder="Re-enter password"
          />
        </div>

        <div class="form-group">
          <label for="ageGroup">Age Group</label>
          <select id="ageGroup" v-model="ageGroup" required>
            <option value="">Select your age group</option>
            <option value="elementary">Elementary (6-10)</option>
            <option value="middle">Middle School (11-14)</option>
            <option value="high">High School (15-18)</option>
          </select>
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="isLoading">
          {{ isLoading ? 'Creating Account...' : 'Register' }}
        </button>
      </form>

      <p class="auth-link">
        Already have an account?
        <router-link to="/login">Login here</router-link>
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
const password = ref('')
const confirmPassword = ref('')
const ageGroup = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)

async function handleRegister() {
  error.value = null

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }

  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }

  try {
    isLoading.value = true
    await authStore.register(email.value, password.value, ageGroup.value)
    // Keep the password in memory only, for auto-login after verification
    authStore.setPendingPassword(password.value)
    // Navigate to email verification page
    router.push({
      name: 'verify-email',
      query: {
        email: email.value,
        ageGroup: ageGroup.value
      }
    })
  } catch (err: any) {
    error.value = err.message || 'Registration failed. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.register-view {
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
  .register-view {
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

  .form-group input,
  .form-group select {
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
  .register-view {
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
