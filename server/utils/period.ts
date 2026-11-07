import { z } from 'zod'

/**
 * Stats period: the last `days` days, or from `since` (ms timestamp) when given. "Today" is sent as
 * `since` because midnight depends on the parent's time zone, which only the browser knows.
 */
export const periodFields = {
  days: z.coerce.number().int().min(1).max(3650).default(30),
  since: z.coerce.number().int().min(0).optional()
}

export function periodStart(period: { days: number, since?: number }): number {
  return period.since ?? Date.now() - period.days * 24 * 60 * 60 * 1000
}
