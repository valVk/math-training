<script setup lang="ts">
import type { LocalizedText } from '#shared/types'

const props = defineProps<{
  index: number
  question: LocalizedText
  unit: LocalizedText
  solved: boolean
  showTranslation: boolean
  submit: (value: string) => Promise<{ correct: boolean, invalid: boolean, canReveal: boolean }>
  reveal: () => Promise<number>
}>()

const { t } = useLocale(CHILD_LOCALE)

const value = ref('')
const feedback = ref<'correct' | 'wrong' | 'invalid' | null>(props.solved ? 'correct' : null)
const canReveal = ref(false)
const revealedValue = ref<number | null>(null)
const busy = ref(false)
const done = computed(() => props.solved || feedback.value === 'correct' || revealedValue.value !== null)

async function onSubmit() {
  if (busy.value || done.value || !value.value.trim()) {
    return
  }
  busy.value = true
  try {
    const result = await props.submit(value.value)
    feedback.value = result.correct ? 'correct' : result.invalid ? 'invalid' : 'wrong'
    canReveal.value = result.canReveal
    if (!result.correct && !result.invalid) {
      value.value = ''
    }
  } finally {
    busy.value = false
  }
}

async function onReveal() {
  busy.value = true
  try {
    revealedValue.value = await props.reveal()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    class="rounded-md border p-5 transition-colors"
    :class="done ? 'border-moss-300 bg-moss-50/70' : 'border-ink-200 bg-ink-50/60'"
  >
    <p class="text-xl leading-relaxed text-ink-900 md:text-2xl">
      <span class="font-display mr-1 text-clay-600">{{ index + 1 }}.</span>
      {{ question.bg }}
    </p>
    <p
      v-if="showTranslation"
      class="mt-1 text-lg italic text-ink-600 md:text-xl"
    >
      {{ question.ru }}
    </p>

    <form
      class="mt-4 flex flex-wrap items-center gap-4"
      @submit.prevent="onSubmit"
    >
      <UInput
        v-model="value"
        :disabled="done"
        inputmode="numeric"
        autocomplete="off"
        size="xl"
        class="w-40"
        :ui="{ base: 'h-14 font-mono text-2xl tabular text-center md:text-3xl' }"
        :aria-label="t('yourAnswer')"
        :placeholder="revealedValue !== null ? String(revealedValue) : ''"
      />
      <span
        v-if="unit.bg"
        class="text-xl text-ink-700 md:text-2xl"
      >{{ unit.bg }}</span>
      <UButton
        v-if="!done"
        type="submit"
        size="xl"
        class="text-lg"
        :loading="busy"
        :label="t('check')"
      />
      <span
        v-if="feedback === 'correct' || solved"
        class="flex items-center gap-2 text-xl text-moss-700 md:text-2xl"
      >
        <UIcon
          name="i-lucide-check"
          class="size-6"
        />
        {{ t('correct') }}
      </span>
    </form>

    <p
      v-if="!done && feedback === 'wrong'"
      class="mt-3 text-lg text-brick-700 md:text-xl"
    >
      {{ t('wrong') }}
    </p>
    <p
      v-if="!done && feedback === 'invalid'"
      class="mt-3 text-lg text-brass-700 md:text-xl"
    >
      {{ t('notANumber') }}
    </p>
    <p
      v-if="revealedValue !== null"
      class="mt-3 text-lg text-ink-700 md:text-xl"
    >
      {{ t('revealed') }}: <span class="font-mono tabular text-xl md:text-2xl">{{ revealedValue }}</span> {{ unit.bg }}
    </p>
    <UButton
      v-if="!done && canReveal"
      class="mt-2 text-lg"
      size="lg"
      color="neutral"
      variant="link"
      :label="t('reveal')"
      @click="onReveal"
    />
  </div>
</template>
