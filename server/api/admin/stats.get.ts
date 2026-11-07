import { z } from 'zod'
import type { AnswerProgress, Problem, RecentAttempt, StatsResponse } from '#shared/types'
import type { StatsAttemptRow } from '../../utils/stats'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).default(30)
})

export default defineEventHandler(async (event): Promise<StatsResponse> => {
  await requireParent(event)
  const query = await getValidatedQuery(event, querySchema.parse)
  const db = useDb()
  const since = Date.now() - query.days * 24 * 60 * 60 * 1000

  const params = { since }
  const rows = db.prepare(`SELECT a.type_key, a.status, a.active_ms, a.answers, a.hint_used, a.translation_opened
    FROM attempts a WHERE a.served_at >= @since`).all(params) as StatsAttemptRow[]

  const order = loadTypeSettings().map(setting => setting.key)

  const recentRows = db.prepare(`SELECT a.id, a.type_key, a.served_at, a.status, a.active_ms, a.answers,
      a.hint_used, a.translation_opened, a.is_return, p.data
    FROM attempts a JOIN problems p ON p.id = a.problem_id
    WHERE a.served_at >= @since AND a.status != 'open'
    ORDER BY a.id DESC LIMIT 40`).all(params) as Array<StatsAttemptRow & { id: number, served_at: number, is_return: number, data: string }>

  const recent: RecentAttempt[] = recentRows.map((row) => {
    const problem = JSON.parse(row.data) as Problem
    const progress = JSON.parse(row.answers) as AnswerProgress[]
    return {
      id: row.id,
      typeKey: row.type_key,
      servedAt: row.served_at,
      status: row.status,
      activeMs: row.active_ms,
      text: problem.text.bg,
      answers: problem.answers.map((answer, index) => ({
        question: answer.question.bg,
        value: answer.value,
        tries: progress[index]?.tries ?? 0,
        wrongValues: progress[index]?.wrongValues ?? [],
        revealed: progress[index]?.revealed ?? false
      })),
      hintUsed: row.hint_used === 1,
      translationOpened: row.translation_opened === 1,
      isReturn: row.is_return === 1
    }
  })

  return { pendingReturns: countPendingReturns(LEARNER), types: computeTypeStats(order, rows), recent }
})
