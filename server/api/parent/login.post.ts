import { z } from 'zod'

const bodySchema = z.object({
  email: z.string().max(200),
  password: z.string().max(200)
})

/** Pause after a wrong password, so guessing by tapping repeatedly is slow. */
const FAILED_LOGIN_DELAY_MS = 1500

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const parents = parseParents(useRuntimeConfig().parents)
  if (parents.size === 0) {
    throw createError({ statusCode: 403, statusMessage: 'No parents configured (NUXT_PARENTS)' })
  }
  if (!isParentLogin(parents, body.email, body.password)) {
    await new Promise(resolve => setTimeout(resolve, FAILED_LOGIN_DELAY_MS))
    throw createError({ statusCode: 401, statusMessage: 'Wrong email or password' })
  }
  await setUserSession(event, {
    user: { email: body.email.trim().toLowerCase() },
    loggedInAt: Date.now()
  })
  return { ok: true }
})
