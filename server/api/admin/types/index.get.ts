export default defineEventHandler(async (event) => {
  await requireParent(event)
  return loadTypeSettings()
})
