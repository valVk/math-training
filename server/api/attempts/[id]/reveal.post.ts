import { z } from 'zod'

const bodySchema = z.object({
  answerIndex: z.number().int().min(0),
  activeMs: z.number().int().min(0)
})

export default defineEventHandler(async (event) => {
  const attemptId = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)
  return revealAnswer(attemptId, LEARNER, body.answerIndex, body.activeMs)
})
