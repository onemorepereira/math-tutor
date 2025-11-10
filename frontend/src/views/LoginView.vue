<template>
  <div class="login-view">
    <div class="auth-card card">
      <h2>Welcome Back!</h2>
      <p class="subtitle">Login to continue your math journey</p>

      <div v-if="error" class="error-message">{{ error }}</div>

      <form @submit.prevent="handleLogin">
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
            placeholder="Enter your password"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="isLoading">
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>
      </form>

      <p class="forgot-password-link">
        <router-link to="/forgot-password">Forgot your password?</router-link>
      </p>

      <p class="auth-link">
        Don't have an account?
        <router-link to="/register">Register here</router-link>
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
const error = ref<string | null>(null)
const isLoading = ref(false)

async function handleLogin() {
  error.value = null

  try {
    isLoading.value = true
    await authStore.login(email.value, password.value)
    router.push({ name: 'home' })
  } catch (err: any) {
    error.value = err.message || 'Login failed. Please check your credentials.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-view {
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

.forgot-password-link {
  text-align: center;
  margin-top: 1rem;
  font-size: 0.9rem;
}

.forgot-password-link a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
}

.forgot-password-link a:hover {
  text-decoration: underline;
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
