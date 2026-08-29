import { ref, computed, onUnmounted } from 'vue'

/**
 * A simple countdown cooldown (e.g. for "resend code" buttons).
 *
 * `cooldownActive` is true while counting down; `cooldownSeconds` ticks to 0.
 * Call `startCooldown()` to begin. The interval is cleared automatically on unmount.
 */
export function useCooldown(durationSeconds = 60) {
  const cooldownSeconds = ref(0)
  const cooldownActive = computed(() => cooldownSeconds.value > 0)
  let interval: ReturnType<typeof setInterval> | null = null

  function clear() {
    if (interval !== null) {
      clearInterval(interval)
      interval = null
    }
  }

  function startCooldown() {
    clear()
    cooldownSeconds.value = durationSeconds
    interval = setInterval(() => {
      cooldownSeconds.value--
      if (cooldownSeconds.value <= 0) {
        clear()
      }
    }, 1000)
  }

  onUnmounted(clear)

  return { cooldownActive, cooldownSeconds, startCooldown }
}
