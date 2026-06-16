import { ref, onUnmounted } from 'vue'

/**
 * A simple countdown cooldown (e.g. for "resend code" buttons).
 *
 * `cooldownActive` is true while counting down; `cooldownSeconds` ticks to 0.
 * Call `startCooldown()` to begin. The interval is cleared automatically on unmount.
 */
export function useCooldown(durationSeconds = 60) {
  const cooldownActive = ref(false)
  const cooldownSeconds = ref(0)
  let interval: ReturnType<typeof setInterval> | null = null

  function clear() {
    if (interval !== null) {
      clearInterval(interval)
      interval = null
    }
  }

  function startCooldown() {
    clear()
    cooldownActive.value = true
    cooldownSeconds.value = durationSeconds
    interval = setInterval(() => {
      cooldownSeconds.value--
      if (cooldownSeconds.value <= 0) {
        cooldownActive.value = false
        clear()
      }
    }, 1000)
  }

  onUnmounted(clear)

  return { cooldownActive, cooldownSeconds, startCooldown }
}
