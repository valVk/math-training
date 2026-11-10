/** The child pressed "show the problem": from here on the attempt is really being worked on. */
export default defineEventHandler((event) => {
  startProblem(Number(getRouterParam(event, 'id')), LEARNER)
  return { ok: true }
})
