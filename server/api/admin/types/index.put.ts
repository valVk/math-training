import { z } from 'zod'

const bodySchema = z.array(z.object({
  key: z.string(),
  enabled: z.boolean()
}))

/** Replaces the whole ordering: array order becomes the priority. */
export default defineEventHandler(async (event) => {
  await requireParent(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const known = new Set(loadTypeSettings().map(setting => setting.key))
  if (body.length !== known.size || body.some(item => !known.has(item.key))) {
    throw createError({ statusCode: 400, statusMessage: 'The list must contain every problem type exactly once' })
  }
  const db = useDb()
  const update = db.prepare('UPDATE type_settings SET position = ?, enabled = ? WHERE type_key = ?')
  db.transaction(() => {
    body.forEach((item, position) => update.run(position, item.enabled ? 1 : 0, item.key))
  })()
  return loadTypeSettings()
})
