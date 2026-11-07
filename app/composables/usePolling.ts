/** Default interval for parent pages that follow the child's progress. */
export const POLL_MS = 10000

/**
 * Calls `refresh` every `intervalMs` while the tab is visible, and right away when the tab becomes
 * visible again, so a parent page stays current without reloading.
 */
export function usePolling(refresh: () => unknown, intervalMs = POLL_MS) {
  let timer: ReturnType<typeof setInterval> | undefined

  function refreshIfVisible() {
    if (document.visibilityState === 'visible') {
      refresh()
    }
  }

  onMounted(() => {
    timer = setInterval(refreshIfVisible, intervalMs)
    document.addEventListener('visibilitychange', refreshIfVisible)
  })
  onUnmounted(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', refreshIfVisible)
  })
}
