import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { onSessionExpired } from './services/session'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

onSessionExpired(async () => {
  try {
    await useAuthStore().logout()
  } catch (err) {
    console.error('Sign-out after session expiry failed:', err)
  }
  router.push({ name: 'login' })
})

app.mount('#app')
