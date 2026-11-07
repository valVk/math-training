<script setup lang="ts">
const { t } = useLocale(PARENT_LOCALE)
const { t: tChild } = useLocale(CHILD_LOCALE)
const { loggedIn, user, clear } = useUserSession()
const route = useRoute()

const isParentArea = computed(() => route.path.startsWith('/admin') || route.path.startsWith('/parent'))
useHead({ htmlAttrs: { lang: () => (isParentArea.value ? PARENT_LOCALE : CHILD_LOCALE) } })

// Parents get their own menu and home page; practice is for the child.
const links = computed(() => loggedIn.value
  ? [{ to: '/admin', label: t('navStats') }, { to: '/admin/types', label: t('navTypes') }]
  : [{ to: '/', label: tChild('navPractice') }])

async function logout() {
  await clear()
  await navigateTo('/')
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b-4 border-double border-ink-300 bg-ink-900 text-ink-50">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <NuxtLink
          :to="loggedIn ? '/admin' : '/'"
          class="flex items-baseline gap-3"
        >
          <span class="font-display text-2xl tracking-wide text-brass-200">{{ tChild('appName') }}</span>
          <span class="hidden text-sm italic text-ink-300 sm:inline">{{ tChild('tagline') }}</span>
        </NuxtLink>

        <nav class="flex gap-1 text-sm">
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="rounded px-3 py-1.5 transition-colors"
            :class="route.path === link.to ? 'bg-ink-700 text-ink-50' : 'text-ink-300 hover:text-ink-50'"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="ml-auto flex items-center gap-3">
          <template v-if="loggedIn">
            <span class="hidden text-sm text-ink-300 md:inline">{{ user?.email }}</span>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              class="text-ink-200 hover:text-ink-50"
              icon="i-lucide-log-out"
              :label="t('logout')"
              @click="logout"
            />
          </template>
          <NuxtLink
            v-else
            to="/parent/login"
            class="flex items-center gap-1.5 text-sm text-ink-300 hover:text-ink-50"
          >
            <UIcon
              name="i-lucide-user-round"
              class="size-4"
            />
            {{ t('navParent') }}
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <slot />
    </main>
  </div>
</template>
