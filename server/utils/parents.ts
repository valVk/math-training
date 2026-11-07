import type { H3Event } from 'h3'
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Parses NUXT_PARENTS: comma-separated `email:password` pairs. The password is everything after the
 * first colon, so it may contain colons but not commas.
 */
export function parseParents(raw: string): Map<string, string> {
  const parents = new Map<string, string>()
  for (const entry of raw.split(',')) {
    const separator = entry.indexOf(':')
    if (separator <= 0) {
      continue
    }
    const email = entry.slice(0, separator).trim().toLowerCase()
    const password = entry.slice(separator + 1).trim()
    if (email && password) {
      parents.set(email, password)
    }
  }
  return parents
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

/** Constant-time check so response timing does not reveal how much of a password matched. */
export function isParentLogin(parents: Map<string, string>, email: string, password: string): boolean {
  const expected = parents.get(email.trim().toLowerCase())
  // Compare against a dummy when the email is unknown, so both cases take the same time.
  return timingSafeEqual(digest(expected ?? '\0'), digest(password)) && expected !== undefined
}

/** Every signed-in user is a parent: only parents can sign in. */
export async function requireParent(event: H3Event) {
  const { user } = await requireUserSession(event)
  // Re-check so removing a parent from NUXT_PARENTS ends their existing sessions too.
  if (!parseParents(useRuntimeConfig().parents).has(user.email)) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Not a parent' })
  }
  return user
}
