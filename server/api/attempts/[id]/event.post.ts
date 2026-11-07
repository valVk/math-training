import { z } from 'zod'

const bodySchema = z.object({
  type: z.enum(['hint', 'translation', 'teacher']),
  activeMs: z.number().int().min(0)
})

export default defineEventHandler(async (event) => {
  const attemptId = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)
  recordEvent(attemptId, LEARNER, body.type, body.activeMs)
  return { ok: true }
})
