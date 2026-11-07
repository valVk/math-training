import { z } from 'zod'
import type { AnalysisResult, AnswerProgress, Problem } from '#shared/types'
import type { StatsAttemptRow } from '../../utils/stats'

const bodySchema = z.object({
  ...periodFields,
  locale: z.enum(['bg', 'ru']).default('bg')
})

const analysisSchema = z.object({
  summary: z.string().describe('3-5 sentences for the parent'),
  perType: z.array(z.object({
    typeKey: z.string(),
    verdict: z.enum(['easy', 'ok', 'hard']),
    note: z.string().describe('One sentence: what the numbers and wrong answers suggest')
  })),
  suggestedOrder: z.array(z.string()).describe('Every typeKey, highest practice priority first'),
  nextSteps: z.array(z.string()).describe('2-4 concrete suggestions for the parent')
})

const SYSTEM_PROMPT = `You help a parent understand how their child (3rd grade, Bulgarian school) is doing in math practice.
You receive per-topic statistics and recent attempts, including the wrong numbers the child typed.
Look for misconceptions behind wrong answers (for example adding instead of multiplying in "N пъти повече" problems, or off-by-ten carrying errors), not only for slow topics.
Translation usage means the child opened the Russian translation of the problem: a hint that reading, not math, was the obstacle.
Teacher usage means the child opened the topic's general explanation of how to solve such problems: a sign the method itself is not yet clear.
Topics with too few attempts deserve a cautious verdict. Suggest an order that puts topics needing practice first while keeping some easy ones for confidence.`

export default defineEventHandler(async (event): Promise<AnalysisResult> => {
  await requireParent(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb()
  const since = periodStart(body)
  const params = { since }

  const rows = db.prepare(`SELECT a.type_key, a.status, a.active_ms, a.answers, a.hint_used, a.translation_opened, a.teacher_used
    FROM attempts a WHERE a.served_at >= @since`).all(params) as StatsAttemptRow[]
  if (rows.length === 0) {
    throw createError({ statusCode: 409, statusMessage: 'No attempts to analyze yet' })
  }

  const settings = loadTypeSettings()
  const order = settings.map(setting => setting.key)
  const stats = computeTypeStats(order, rows).map(item => ({
    ...item,
    title: findProblemType(item.typeKey)?.title.bg,
    enabled: settings.find(setting => setting.key === item.typeKey)?.enabled
  }))

  const recent = (db.prepare(`SELECT a.type_key, a.status, a.active_ms, a.answers, a.hint_used, a.translation_opened, a.teacher_used, p.data
    FROM attempts a JOIN problems p ON p.id = a.problem_id
    WHERE a.served_at >= @since AND a.status != 'open'
    ORDER BY a.id DESC LIMIT 60`).all(params) as Array<StatsAttemptRow & { data: string }>)
    .map((row) => {
      const problem = JSON.parse(row.data) as Problem
      const progress = JSON.parse(row.answers) as AnswerProgress[]
      return {
        typeKey: row.type_key,
        status: row.status,
        activeSeconds: Math.round(row.active_ms / 1000),
        text: problem.text.bg,
        answers: problem.answers.map((answer, index) => ({
          question: answer.question.bg,
          correct: answer.value,
          wrongTyped: progress[index]?.wrongValues ?? [],
          revealed: progress[index]?.revealed ?? false
        })),
        hintUsed: row.hint_used === 1,
        teacherUsed: row.teacher_used === 1,
        translationOpened: row.translation_opened === 1
      }
    })

  const language = body.locale === 'ru' ? 'Russian' : 'Bulgarian'
  const result = await askClaudeStructured({
    system: SYSTEM_PROMPT,
    schema: analysisSchema,
    effort: 'high',
    prompt: `Write every text field in ${language}. Use the typeKey values exactly as given.

Current order (highest priority first): ${JSON.stringify(order)}

Per-topic statistics (rates are 0-1, times in milliseconds of active time):
${JSON.stringify(stats, null, 2)}

Recent attempts, newest first:
${JSON.stringify(recent, null, 2)}`
  })

  // Keep the suggestion usable even if the model drops or invents keys.
  const known = new Set(order)
  const suggested = [...new Set(result.suggestedOrder.filter(key => known.has(key)))]
  for (const key of order) {
    if (!suggested.includes(key)) {
      suggested.push(key)
    }
  }

  return {
    summary: result.summary,
    perType: result.perType.filter(item => known.has(item.typeKey)),
    suggestedOrder: suggested,
    nextSteps: result.nextSteps
  }
})
