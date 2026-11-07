/** Lets the child's page notice that a parent skipped the problem from the parent page. */
export default defineEventHandler((event) => {
  const attemptId = Number(getRouterParam(event, 'id'))
  return { status: attemptStatus(attemptId, LEARNER) }
})
