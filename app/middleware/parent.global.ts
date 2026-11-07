/** Statistics and topic settings are for parents only; practice stays open to the child. */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  if (to.path.startsWith('/admin') && !loggedIn.value) {
    return navigateTo({ path: '/parent/login', query: { redirect: to.fullPath } })
  }
})
