/** No input for this long counts as a break and stops the clock. */
const IDLE_AFTER_MS = 60_000
const TICK_MS = 500
/**
 * A longer gap between ticks means timers were suspended (tablet asleep, browser throttled), not
 * that the child was working; only this much of it is counted.
 */
const MAX_TICK_GAP_MS = 2 * TICK_MS

/**
 * Counts only time the child is plausibly working: the tab is visible and there was
 * input within the last minute. Wall-clock time would include breaks and inflate the metric.
 */
export function useActiveTimer() {
  const activeMs = ref(0)
  let lastTick = 0
  let lastActivity = 0
  let interval: ReturnType<typeof setInterval> | null = null

  const markActivity = () => {
    lastActivity = Date.now()
  }

  const tick = () => {
    const now = Date.now()
    const visible = document.visibilityState === 'visible'
    if (visible && now - lastActivity < IDLE_AFTER_MS) {
      activeMs.value += Math.min(now - lastTick, MAX_TICK_GAP_MS)
    }
    lastTick = now
  }

  const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'] as const

  function start(initialMs = 0) {
    stop()
    activeMs.value = initialMs
    lastTick = Date.now()
    markActivity()
    activityEvents.forEach(name => window.addEventListener(name, markActivity, { passive: true }))
    document.addEventListener('visibilitychange', markActivity)
    interval = setInterval(tick, TICK_MS)
  }

  function stop() {
    if (interval) {
      tick()
      clearInterval(interval)
      interval = null
    }
    activityEvents.forEach(name => window.removeEventListener(name, markActivity))
    document.removeEventListener('visibilitychange', markActivity)
  }

  /** Current value including the partial tick, for sending to the server. */
  function read(): number {
    if (interval) {
      tick()
    }
    return Math.round(activeMs.value)
  }

  onBeforeUnmount(stop)

  return { activeMs, start, stop, read }
}
