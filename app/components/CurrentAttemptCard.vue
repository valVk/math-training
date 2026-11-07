<script setup lang="ts">
import type { CurrentAttempt } from '#shared/types'

const { t, pick } = useLocale(PARENT_LOCALE)
const { data, refresh } = await useFetch<{ attempt: CurrentAttempt | null }>('/api/admin/current')
const attempt = computed(() => data.value?.attempt ?? null)
usePolling(refresh)

const units = computed(() => ({ seconds: t('seconds'), minutes: t('minutes') }))
const typeTitle = (key: string) => {
  const type = findProblemType(key)
  return type ? pick(type.title) : key
}
</script>

<template>
  <section class="rounded-lg border border-ink-200 bg-ink-50/60 p-6">
    <h2 class="flex items-center gap-2 font-display text-2xl">
      <span
        class="size-2.5 rounded-full"
        :class="attempt ? 'animate-pulse bg-moss-500' : 'bg-ink-300'"
      />
      {{ t('currentTitle') }}
    </h2>

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
        <span>{{ t('currentStarted') }} {{ new Date(attempt.servedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }}</span>
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
