<template>
  <Transition name="toast">
    <div v-if="gameError" class="error-toast" role="alert">
      <span class="toast-text">{{ gameError }}</span>
      <button class="toast-dismiss" @click="dismiss" aria-label="Dismiss">✕</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()
const gameError = computed(() => gameStore.error)

let timeout: ReturnType<typeof setTimeout> | null = null

watch(gameError, (value) => {
  if (timeout !== null) clearTimeout(timeout)
  if (value) {
    timeout = setTimeout(dismiss, 6000)
  }
})

function dismiss() {
  if (timeout !== null) {
    clearTimeout(timeout)
    timeout = null
  }
  gameStore.error = null
}
</script>

<style scoped>
.error-toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #dc3545;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  z-index: 1100;
  max-width: min(90vw, 480px);
}

.toast-text {
  font-size: 0.95rem;
}

.toast-dismiss {
  background: none;
  border: none;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.1rem 0.3rem;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
