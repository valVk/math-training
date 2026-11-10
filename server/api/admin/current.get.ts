import type { AnswerProgress, CurrentAttempt, Problem } from '#shared/types'

interface CurrentRow {
  id: number
  problem_id: number
  type_key: string
  served_at: number
  started_at: number | null
  active_ms: number
  answers: string
  hint_used: number
  translation_opened: number
  teacher_used: number
  is_return: number
  data: string
}

/** The child's open attempt with its solutions and progress, or null when nothing is being solved. */
export default defineEventHandler(async (event): Promise<{ attempt: CurrentAttempt | null }> => {
  await requireParent(event)
  const row = useDb().prepare(`SELECT a.id, a.problem_id, a.type_key, a.served_at, a.started_at, a.active_ms, a.answers, a.hint_used,
      a.translation_opened, a.teacher_used, a.is_return, p.data
    FROM attempts a JOIN problems p ON p.id = a.problem_id
    WHERE a.user_email = ? AND a.status = 'open' AND a.served_at >= ?
    ORDER BY a.id DESC LIMIT 1`)
    .get(LEARNER, Date.now() - RESUME_WINDOW_MS) as CurrentRow | undefined

  if (!row) {
    return { attempt: null }
  }
  const problem = JSON.parse(row.data) as Problem
  const progress = JSON.parse(row.answers) as AnswerProgress[]
  return {
    attempt: {
      id: row.id,
      problemId: row.problem_id,
      typeKey: row.type_key,
      servedAt: row.served_at,
      startedAt: row.started_at,
      activeMs: row.active_ms,
      text: problem.text,
      answers: problem.answers.map((answer, index) => ({
        question: answer.question,
        unit: answer.unit,
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
  }
})
