<script setup lang="ts">
import type { CurrentAttempt } from '#shared/types'

const emit = defineEmits<{ changed: [] }>()

const { t, pick } = useLocale(PARENT_LOCALE)
const toast = useToast()
const { data, refresh } = await useFetch<{ attempt: CurrentAttempt | null }>('/api/admin/current')
const attempt = computed(() => data.value?.attempt ?? null)
usePolling(refresh)

/**
 * Skip (the problem comes back later) or retire (a broken problem, never shown again). Both ask for
 * a second click, so a stray tap does not take the problem away from the child.
 */
type Action = 'skip' | 'retire'
const confirming = ref<Action | null>(null)
const busy = ref(false)
watch(() => attempt.value?.id, () => (confirming.value = null))

const confirmText = { skip: 'currentSkipConfirm', retire: 'retireConfirm' } as const
const confirmLabel = { skip: 'currentSkipYes', retire: 'retireYes' } as const

async function run(action: Action) {
  if (!attempt.value) {
    return
  }
  busy.value = true
  try {
    if (action === 'skip') {
      await $fetch(`/api/attempts/${attempt.value.id}/skip`, { method: 'POST', body: { activeMs: attempt.value.activeMs } })
    } else {
      await $fetch(`/api/admin/problems/${attempt.value.problemId}/retire`, { method: 'POST' })
    }
    toast.add({ title: t(action === 'skip' ? 'currentSkipped' : 'retired'), color: 'success' })
    emit('changed')
  } catch (error) {
    toast.add({ title: (error as { statusMessage?: string }).statusMessage ?? String(error), color: 'error' })
  } finally {
    busy.value = false
    confirming.value = null
    await refresh()
  }
}

const units = computed(() => ({ seconds: t('seconds'), minutes: t('minutes') }))
const typeTitle = (key: string) => {
  const type = findProblemType(key)
  return type ? pick(type.title) : key
}
</script>

<template>
  <section class="rounded-lg border border-ink-200 bg-ink-50/60 p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="flex items-center gap-2 font-display text-2xl">
        <span
          class="size-2.5 rounded-full"
          :class="attempt ? 'animate-pulse bg-moss-500' : 'bg-ink-300'"
        />
        {{ t('currentTitle') }}
      </h2>
      <div
        v-if="attempt"
        class="flex flex-wrap items-center gap-2"
      >
        <template v-if="confirming">
          <span class="text-sm text-ink-700">{{ t(confirmText[confirming]) }}</span>
          <UButton
            color="error"
            :loading="busy"
            :label="t(confirmLabel[confirming])"
            @click="run(confirming)"
          />
          <UButton
            color="neutral"
            variant="ghost"
            :label="t('reset')"
            @click="confirming = null"
          />
        </template>
        <template v-else>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-skip-forward"
            :label="t('currentSkip')"
            @click="confirming = 'skip'"
          />
          <UButton
            color="error"
            variant="outline"
            icon="i-lucide-trash-2"
            :label="t('retire')"
            @click="confirming = 'retire'"
          />
        </template>
      </div>
    </div>

    <p
      v-if="!attempt"
      class="mt-3 text-ink-600"
    >
      {{ t('currentNone') }}
    </p>

    <div
      v-else
      class="mt-4 space-y-4"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
        <span class="uppercase tracking-wider text-clay-700">{{ typeTitle(attempt.typeKey) }}</span>
        <span v-if="attempt.startedAt">{{ t('currentStarted') }} {{ new Date(attempt.startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }}</span>
        <UBadge
          v-else
          color="neutral"
          variant="subtle"
          :label="t('notStarted')"
        />
        <span :title="t('currentActiveNote')">
          {{ t('currentActive') }} <span class="tabular">{{ formatDuration(attempt.activeMs, units) }}</span>
        </span>
        <UBadge
          v-if="attempt.isReturn"
          color="warning"
          variant="subtle"
          :label="t('statusReturn')"
        />
        <UBadge
          v-if="attempt.hintUsed"
          color="secondary"
          variant="subtle"
          :label="t('colHint')"
        />
        <UBadge
          v-if="attempt.teacherUsed"
          color="success"
          variant="subtle"
          :label="t('colTeacher')"
        />
        <UBadge
          v-if="attempt.translationOpened"
          color="secondary"
          variant="subtle"
          :label="t('colTranslation')"
        />
      </div>

      <div>
        <p class="text-lg leading-relaxed">
          {{ attempt.text.bg }}
        </p>
        <p class="mt-1 italic text-ink-600">
          {{ attempt.text.ru }}
        </p>
      </div>

      <ul class="space-y-3">
        <li
          v-for="(answer, index) in attempt.answers"
          :key="index"
          class="flex gap-3"
        >
          <UIcon
            :name="answer.solved ? 'i-lucide-circle-check' : answer.revealed ? 'i-lucide-eye' : 'i-lucide-circle-dashed'"
            class="mt-1 size-5 shrink-0"
            :class="answer.solved ? 'text-moss-600' : answer.revealed ? 'text-brass-600' : 'text-ink-400'"
          />
          <div>
            <p>
              {{ answer.question.bg }}
              <span class="italic text-ink-600">({{ answer.question.ru }})</span>
            </p>
            <p class="mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-700">
              <span>
                {{ t('currentAnswer') }}:
                <span class="font-mono tabular">{{ answer.value }}</span> {{ answer.unit.ru }}
              </span>
              <span>
                {{ answer.solved ? t('currentSolved') : answer.revealed ? t('statusRevealed') : t('currentWaiting') }}
              </span>
              <span v-if="answer.tries">{{ t('currentTries') }}: <span class="tabular">{{ answer.tries }}</span></span>
              <span
                v-if="answer.wrongValues.length"
                class="text-brick-700"
              >
                {{ t('wrongTyped') }}: <span class="font-mono tabular">{{ answer.wrongValues.join(', ') }}</span>
              </span>
            </p>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
