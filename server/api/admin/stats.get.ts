import { z } from 'zod'
import type { AnswerProgress, AttemptStatus, Problem, RecentAttempt, StatsResponse } from '#shared/types'
import type { StatsAttemptRow } from '../../utils/stats'

const querySchema = z.object(periodFields)

export default defineEventHandler(async (event): Promise<StatsResponse> => {
  await requireParent(event)
  const query = await getValidatedQuery(event, querySchema.parse)
  const db = useDb()
  const since = periodStart(query)

  const params = { since }
  // Problems a parent removed as broken are left out of everything the parent sees.
  const rows = db.prepare(`SELECT a.type_key, a.status, a.active_ms, a.answers, a.hint_used, a.translation_opened, a.teacher_used
    FROM attempts a JOIN problems p ON p.id = a.problem_id
    WHERE a.served_at >= @since AND p.retired = 0`).all(params) as StatsAttemptRow[]

  const order = loadTypeSettings().map(setting => setting.key)

  const attemptRows = db.prepare(`SELECT a.id, a.problem_id, a.type_key, a.served_at, a.status, a.active_ms, a.answers,
      a.hint_used, a.translation_opened, a.teacher_used, a.is_return, p.data
    FROM attempts a JOIN problems p ON p.id = a.problem_id
    WHERE a.served_at >= @since AND a.status != 'open' AND p.retired = 0
    ORDER BY a.id DESC LIMIT 400`).all(params) as Array<StatsAttemptRow & { id: number, problem_id: number, served_at: number, is_return: number, data: string }>

  // One entry per problem: its latest attempt, with the outcomes of the earlier ones (a problem
  // abandoned overnight and solved the next day would otherwise appear twice).
  const earlier = new Map<number, AttemptStatus[]>()
  const recentRows = attemptRows.filter((row) => {
    const seen = earlier.get(row.problem_id)
    if (seen) {
      seen.push(row.status)
      return false
    }
    earlier.set(row.problem_id, [])
    return true
  }).slice(0, 40)

  const recent: RecentAttempt[] = recentRows.map((row) => {
    const problem = JSON.parse(row.data) as Problem
    const progress = JSON.parse(row.answers) as AnswerProgress[]
    return {
      id: row.id,
      problemId: row.problem_id,
      earlierStatuses: earlier.get(row.problem_id) ?? [],
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
        solved: progress[index]?.solvedAtMs != null,
        revealed: progress[index]?.revealed ?? false
      })),
      hintUsed: row.hint_used === 1,
      translationOpened: row.translation_opened === 1,
      teacherUsed: row.teacher_used === 1,
      isReturn: row.is_return === 1
    }
  })

  return {
    pendingReturns: countPendingReturns(LEARNER),
    types: computeTypeStats(order, rows),
    total: computeTotalStats(rows),
    recent
  }
})
