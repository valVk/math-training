import type { AnswerProgress, AttemptStatus, TypeStats } from '../../shared/types'
import { TOTAL_KEY } from '../../shared/utils/statsKeys'

export interface StatsAttemptRow {
  type_key: string
  status: AttemptStatus
  active_ms: number
  answers: string
  hint_used: number
  translation_opened: number
  teacher_used: number
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

function rate(part: number, total: number): number | null {
  return total === 0 ? null : part / total
}

/** Aggregates finished attempts per type. Open attempts are ignored; abandoned ones count as skipped. */
export function computeTypeStats(typeKeys: string[], rows: StatsAttemptRow[]): TypeStats[] {
  return typeKeys.map((typeKey) => {
    const finished = rows.filter(row => row.type_key === typeKey && row.status !== 'open')
    const completed = finished.filter(row => row.status === 'solved' || row.status === 'revealed')
    const solved = finished.filter(row => row.status === 'solved')
    const progress = completed.map(row => JSON.parse(row.answers) as AnswerProgress[])

    const firstTry = progress.filter(answers => answers.every(item => item.tries === 1 && !item.revealed)).length
    const allAnswers = progress.flat()
    const totalTries = allAnswers.reduce((sum, item) => sum + item.tries, 0)

    return {
      typeKey,
      attempts: finished.length,
      solved: solved.length,
      skipped: finished.filter(row => row.status === 'skipped' || row.status === 'abandoned').length,
      revealed: finished.filter(row => row.status === 'revealed').length,
      firstTryRate: rate(firstTry, finished.length),
      medianActiveMs: median(solved.map(row => row.active_ms)),
      avgTries: allAnswers.length ? totalTries / allAnswers.length : null,
      hintRate: rate(finished.filter(row => row.hint_used === 1).length, finished.length),
      teacherRate: rate(finished.filter(row => row.teacher_used === 1).length, finished.length),
      translationRate: rate(finished.filter(row => row.translation_opened === 1).length, finished.length)
    }
  })
}

/** The same aggregates over all topics together. */
export function computeTotalStats(rows: StatsAttemptRow[]): TypeStats {
  return computeTypeStats([TOTAL_KEY], rows.map(row => ({ ...row, type_key: TOTAL_KEY })))[0]!
}
