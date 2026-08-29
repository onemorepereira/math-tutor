<template>
  <div class="loading-overlay" role="status" aria-live="polite">
    <div class="loading-card">
      <div class="ninja">🥷</div>
      <div class="spinner-ring"></div>
      <p class="message">{{ messages[messageIndex] }}</p>
      <p class="note">Your problems are being freshly made — just a few seconds!</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const messages = [
  'Sharpening pencils… ✏️',
  'Counting shurikens… 🌟',
  'Warming up the math dojo… 🏯',
  'Balancing equations on one finger… ☝️',
  'Hiding the answers in plain sight… 🙈'
]

const messageIndex = ref(0)
let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  interval = setInterval(() => {
    messageIndex.value = (messageIndex.value + 1) % messages.length
  }, 2500)
})

onUnmounted(() => {
  if (interval !== null) clearInterval(interval)
})
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-card {
  text-align: center;
  padding: 2rem;
}

.ninja {
  font-size: 4rem;
  animation: bounce 1.2s ease-in-out infinite;
}

.spinner-ring {
  width: 48px;
  height: 48px;
  margin: 1rem auto;
  border: 4px solid #e9ecef;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

.message {
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
  min-height: 1.8rem;
}

.note {
  color: #6c757d;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
</style>
