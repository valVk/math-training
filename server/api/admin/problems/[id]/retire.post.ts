/** A parent removes a broken problem (nonsense text, wrong answer) from rotation. */
export default defineEventHandler(async (event) => {
  await requireParent(event)
  retireProblem(Number(getRouterParam(event, 'id')), LEARNER)
  return { ok: true }
})
