<script setup lang="ts">
const { t } = useLocale(PARENT_LOCALE)
const route = useRoute()

function onSuccess() {
  const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
    ? route.query.redirect
    : '/admin'
  return navigateTo(redirect)
}
</script>

<template>
  <div class="mx-auto mt-8 max-w-md">
    <div class="notebook rounded-lg border border-ink-200 p-8 shadow-[4px_4px_0_var(--color-ink-200)]">
      <h1 class="font-display text-3xl">
        {{ t('loginTitle') }}
      </h1>
      <p class="mt-2 text-ink-600">
        {{ t('loginText') }}
      </p>
      <ParentLoginForm
        class="mt-6"
        @success="onSuccess"
      />
    </div>
  </div>
</template>
