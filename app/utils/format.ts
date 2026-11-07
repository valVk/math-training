export function formatDuration(ms: number | null, units: { seconds: string, minutes: string }): string {
  if (ms === null) {
    return '-'
  }
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) {
    return `${seconds} ${units.seconds}`
  }
  return `${minutes} ${units.minutes} ${String(seconds).padStart(2, '0')} ${units.seconds}`
}

export function formatPercent(rate: number | null): string {
  return rate === null ? '-' : `${Math.round(rate * 100)}%`
}
