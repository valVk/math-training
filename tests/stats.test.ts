import { describe, expect, it } from 'vitest'
import { computeTypeStats, type StatsAttemptRow } from '../server/utils/stats'

function row(partial: Partial<StatsAttemptRow> & { answers: object[] }): StatsAttemptRow {
  return {
    type_key: 't',
    status: 'solved',
    active_ms: 10000,
    hint_used: 0,
    translation_opened: 0,
    teacher_used: 0,
    ...partial,
    answers: JSON.stringify(partial.answers)
  }
}

const solvedFirstTry = { tries: 1, wrongValues: [], solvedAtMs: 5000, revealed: false }
const solvedSecondTry = { tries: 2, wrongValues: [10], solvedAtMs: 8000, revealed: false }

describe('computeTypeStats', () => {
  it('aggregates rates, medians and tries', () => {
    const [stats] = computeTypeStats(['t'], [
      row({ answers: [solvedFirstTry, solvedFirstTry], active_ms: 10000 }),
      row({ answers: [solvedSecondTry], active_ms: 30000, translation_opened: 1 }),
      row({ answers: [{ tries: 0, wrongValues: [], solvedAtMs: null, revealed: false }], status: 'skipped' }),
      row({ answers: [solvedFirstTry], status: 'open' })
    ])
    expect(stats).toMatchObject({
      attempts: 3,
      solved: 2,
      skipped: 1,
      firstTryRate: 1 / 3,
      medianActiveMs: 20000,
      avgTries: 4 / 3,
      translationRate: 1 / 3
    })
  })

  it('returns nulls for types without attempts', () => {
    const [stats] = computeTypeStats(['empty'], [])
    expect(stats).toMatchObject({ attempts: 0, firstTryRate: null, medianActiveMs: null })
  })
})
