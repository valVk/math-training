import { z } from 'zod'

const bodySchema = z.object({
  activeMs: z.number().int().min(0)
})

/** Only a signed-in parent may skip. The problem comes back later, see `nextProblemFor`. */
export default defineEventHandler(async (event) => {
  await requireParent(event)
  const attemptId = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)
  skipAttempt(attemptId, LEARNER, body.activeMs)
  return { ok: true }
})
