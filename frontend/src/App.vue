<template>
  <div id="app" class="app-container">
    <header v-if="isAuthenticated" class="app-header">
      <div class="header-content">
        <router-link to="/" class="logo-link">
          <h1 class="logo">
            <span class="logo-emoji">🎓</span>
            <span class="logo-text">Math Tutor</span>
            <span class="logo-emoji">✨</span>
          </h1>
        </router-link>
        <div class="user-info">
          <span class="user-greeting">Hey, <strong>{{ user?.screenName }}</strong>!</span>
          <button @click="handleLogout" class="btn-logout">Logout</button>
        </div>
      </div>
    </header>

    <main class="app-main">
      <router-view />
    </main>

    <footer class="app-footer">
      <p>&copy; 2025 Miguel Pereira | Learn Math the Fun Way!</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)
const user = computed(() => authStore.user)

async function handleLogout() {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  color: white;
  padding: 1.25rem 2rem;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
  position: relative;
  overflow: hidden;
}

.app-header::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -10%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  border-radius: 50%;
}

.app-header::after {
  content: '';
  position: absolute;
  bottom: -50%;
  left: -5%;
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, transparent 70%);
  border-radius: 50%;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 1;
}

.logo-link {
  text-decoration: none;
  color: inherit;
  transition: transform 0.3s ease;
  display: block;
}

.logo-link:hover {
  transform: scale(1.05);
}

.logo {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.logo-emoji {
  font-size: 2rem;
  display: inline-block;
  animation: bounce 2s ease-in-out infinite;
}

.logo-emoji:first-child {
  animation-delay: 0s;
}

.logo-emoji:last-child {
  animation-delay: 0.3s;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.logo-text {
  font-family: 'Comic Sans MS', 'Chalkboard SE', 'Arial Rounded MT Bold', cursive, sans-serif;
  letter-spacing: 1px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.user-greeting {
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.15);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.user-greeting strong {
  color: #ffd700;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

.btn-logout {
  padding: 0.6rem 1.5rem;
  background: rgba(255, 255, 255, 0.25);
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 25px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.85rem;
  letter-spacing: 0.5px;
  backdrop-filter: blur(10px);
}

.btn-logout:hover {
  background: rgba(255, 255, 255, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.app-main {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
}

.app-footer {
  background: #f8f9fa;
  padding: 1rem;
  text-align: center;
  color: #6c757d;
  font-size: 0.875rem;
}
</style>
