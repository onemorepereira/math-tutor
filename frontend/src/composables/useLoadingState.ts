import { ref } from 'vue'

/**
 * Encapsulates the repeated `isLoading` / `error` async pattern used across stores.
 *
 * Wrap an async operation with `withLoading`: it toggles `isLoading`, captures a
 * sanitized error message on failure (then re-throws), and clears `isLoading` when done.
 */
export function useLoadingState() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function withLoading<T>(
    fn: () => Promise<T>,
    fallbackMessage = 'Something went wrong'
  ): Promise<T> {
    isLoading.value = true
    error.value = null

    try {
      return await fn()
    } catch (err: any) {
      error.value = err?.message || fallbackMessage
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, error, withLoading }
}
