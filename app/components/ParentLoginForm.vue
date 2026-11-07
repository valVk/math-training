<script setup lang="ts">
const emit = defineEmits<{ success: [] }>()

const { t } = useLocale(PARENT_LOCALE)
const { fetch: refreshSession } = useUserSession()

const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref<'wrongCredentials' | 'noParents' | null>(null)

async function submit() {
  busy.value = true
  error.value = null
  try {
    await $fetch('/api/parent/login', { method: 'POST', body: { email: email.value, password: password.value } })
    await refreshSession()
    emit('success')
  } catch (caught) {
    // 403 means NUXT_PARENTS is empty on the server, which no password can fix.
    error.value = (caught as { statusCode?: number }).statusCode === 403 ? 'noParents' : 'wrongCredentials'
  } finally {
    password.value = ''
    busy.value = false
  }
}
</script>

<template>
  <form
    class="space-y-4"
    @submit.prevent="submit"
  >
    <UFormField :label="t('parentEmail')">
      <UInput
        v-model="email"
        type="email"
        autocomplete="username"
        size="xl"
        class="w-full"
      />
    </UFormField>
    <UFormField :label="t('parentPassword')">
      <UInput
        v-model="password"
        type="password"
        autocomplete="current-password"
        size="xl"
        class="w-full"
      />
    </UFormField>
    <p
      v-if="error"
      class="text-brick-700"
    >
      {{ t(error) }}
    </p>
    <div class="flex justify-end gap-3">
      <slot name="actions" />
      <UButton
        type="submit"
        size="lg"
        :loading="busy"
        :disabled="!email || !password"
        :label="t('loginButton')"
      />
    </div>
  </form>
</template>
