<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AnalysisResult, AttemptStatus, StatsResponse, TypeSetting, TypeStats } from '#shared/types'

const { t, pick, locale } = useLocale(PARENT_LOCALE)
const toast = useToast()

const days = ref(30)

const query = computed(() => ({ days: days.value }))
const { data: stats, status, refresh } = await useFetch<StatsResponse>('/api/admin/stats', { query })
usePolling(refresh)

const units = computed(() => ({ seconds: t('seconds'), minutes: t('minutes') }))
const typeTitle = (key: string) => {
  const type = findProblemType(key)
  return type ? pick(type.title) : key
}

const periodItems = computed(() => [
  { label: t('days7'), value: 7 },
  { label: t('days30'), value: 30 },
  { label: t('days90'), value: 90 },
  { label: t('days365'), value: 365 }
])

const rows = computed(() => (stats.value?.types ?? []).filter(row => row.attempts > 0))

const columns = computed<TableColumn<TypeStats>[]>(() => [
  { accessorKey: 'typeKey', header: t('colType') },
  { accessorKey: 'attempts', header: t('colAttempts') },
  { accessorKey: 'firstTryRate', header: t('colFirstTry') },
  { accessorKey: 'medianActiveMs', header: t('colMedian') },
  { accessorKey: 'avgTries', header: t('colTries') },
  { accessorKey: 'hintRate', header: t('colHint') },
  { accessorKey: 'teacherRate', header: t('colTeacher') },
  { accessorKey: 'translationRate', header: t('colTranslation') },
  { accessorKey: 'skipped', header: t('colSkipped') }
])

const statusLabel: Record<Exclude<AttemptStatus, 'open'>, Parameters<typeof t>[0]> = {
  solved: 'statusSolved',
  revealed: 'statusRevealed',
  skipped: 'statusSkipped',
  abandoned: 'statusAbandoned'
}

const analysis = ref<AnalysisResult | null>(null)
const analyzing = ref(false)

async function analyze() {
  analyzing.value = true
  try {
    analysis.value = await $fetch<AnalysisResult>('/api/admin/analyze', {
      method: 'POST',
      body: { ...query.value, locale }
    })
  } catch (error) {
    toast.add({ title: (error as { statusMessage?: string }).statusMessage ?? String(error), color: 'error' })
  } finally {
    analyzing.value = false
  }
}

async function applySuggestedOrder() {
  if (!analysis.value) {
    return
  }
  const current = await $fetch<TypeSetting[]>('/api/admin/types')
  const enabled = new Map(current.map(setting => [setting.key, setting.enabled]))
  await $fetch('/api/admin/types', {
    method: 'PUT',
    body: analysis.value.suggestedOrder.map(key => ({ key, enabled: enabled.get(key) ?? true }))
  })
  toast.add({ title: t('orderApplied'), color: 'success' })
}

const verdictColor = { easy: 'success', ok: 'neutral', hard: 'error' } as const
const verdictLabel = { easy: 'verdictEasy', ok: 'verdictOk', hard: 'verdictHard' } as const
</script>

<template>
  <div class="space-y-10">
    <CurrentAttemptCard @skipped="refresh" />

    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="font-display text-3xl">
            {{ t('statsTitle') }}
          </h1>
          <p
            v-if="stats?.pendingReturns"
            class="mt-1 flex items-center gap-1.5 text-brass-700"
          >
            <UIcon
              name="i-lucide-rotate-ccw"
              class="size-4"
            />
            {{ t('pendingReturns') }}: <span class="tabular">{{ stats.pendingReturns }}</span>
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <UFormField :label="t('period')">
            <USelect
              v-model="days"
              :items="periodItems"
              class="w-32"
            />
          </UFormField>
        </div>
      </div>

      <div class="mt-6 overflow-x-auto rounded-lg border border-ink-200 bg-ink-50/60">
        <UTable
          :data="rows"
          :columns="columns"
          :loading="status === 'pending' && !stats"
          :empty="t('noData')"
        >
          <template #typeKey-cell="{ row }">
            <span class="font-medium">{{ typeTitle(row.original.typeKey) }}</span>
          </template>
          <template #firstTryRate-cell="{ row }">
            <div class="flex items-center gap-2">
              <div class="h-1.5 w-16 overflow-hidden rounded bg-ink-200">
                <div
                  class="h-full bg-moss-500"
                  :style="{ width: formatPercent(row.original.firstTryRate) }"
                />
              </div>
              <span class="tabular">{{ formatPercent(row.original.firstTryRate) }}</span>
            </div>
          </template>
          <template #medianActiveMs-cell="{ row }">
            <span class="tabular">{{ formatDuration(row.original.medianActiveMs, units) }}</span>
          </template>
          <template #avgTries-cell="{ row }">
            <span class="tabular">{{ row.original.avgTries?.toFixed(1) ?? '-' }}</span>
          </template>
          <template #hintRate-cell="{ row }">
            <span class="tabular">{{ formatPercent(row.original.hintRate) }}</span>
          </template>
          <template #teacherRate-cell="{ row }">
            <span class="tabular">{{ formatPercent(row.original.teacherRate) }}</span>
          </template>
          <template #translationRate-cell="{ row }">
            <span class="tabular">{{ formatPercent(row.original.translationRate) }}</span>
          </template>
        </UTable>
      </div>
    </section>

    <section class="rounded-lg border border-ink-200 bg-ink-50/60 p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="font-display text-2xl">
            {{ t('analysisTitle') }}
          </h2>
          <p class="mt-1 text-ink-600">
            {{ t('analysisText') }}
          </p>
        </div>
        <UButton
          icon="i-lucide-sparkles"
          :loading="analyzing"
          :label="analyzing ? t('analyzing') : t('analyze')"
          @click="analyze"
        />
      </div>

      <div
        v-if="analysis"
        class="mt-6 space-y-6"
      >
        <p class="text-lg leading-relaxed">
          {{ analysis.summary }}
        </p>

        <ul class="space-y-2">
          <li
            v-for="item in analysis.perType"
            :key="item.typeKey"
            class="flex flex-wrap items-baseline gap-2"
          >
            <UBadge
              :color="verdictColor[item.verdict]"
              variant="subtle"
              :label="t(verdictLabel[item.verdict])"
            />
            <span class="font-medium">{{ typeTitle(item.typeKey) }}:</span>
            <span class="text-ink-700">{{ item.note }}</span>
          </li>
        </ul>

        <div>
          <h3 class="font-display text-lg">
            {{ t('nextSteps') }}
          </h3>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-ink-800">
            <li
              v-for="step in analysis.nextSteps"
              :key="step"
            >
              {{ step }}
            </li>
          </ul>
        </div>

        <div>
          <h3 class="font-display text-lg">
            {{ t('suggestedOrder') }}
          </h3>
          <ol class="mt-2 list-decimal space-y-0.5 pl-6 text-ink-800">
            <li
              v-for="key in analysis.suggestedOrder"
              :key="key"
            >
              {{ typeTitle(key) }}
            </li>
          </ol>
          <UButton
            class="mt-4"
            color="secondary"
            variant="outline"
            :label="t('applyOrder')"
            @click="applySuggestedOrder"
          />
        </div>
      </div>
    </section>

    <section>
      <h2 class="font-display text-2xl">
        {{ t('recentTitle') }}
      </h2>
      <p
        v-if="!stats?.recent.length"
        class="mt-3 text-ink-600"
      >
        {{ t('noData') }}
      </p>
      <ul class="mt-4 space-y-3">
        <li
          v-for="attempt in stats?.recent"
          :key="attempt.id"
          class="rounded-md border border-ink-200 bg-ink-50/60 p-4"
        >
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
            <span class="uppercase tracking-wider text-clay-700">{{ typeTitle(attempt.typeKey) }}</span>
            <span>{{ new Date(attempt.servedAt).toLocaleString('ru-RU') }}</span>
            <span class="tabular">{{ formatDuration(attempt.activeMs, units) }}</span>
            <UBadge
              :color="attempt.status === 'solved' ? 'success' : 'neutral'"
              variant="subtle"
              :label="t(statusLabel[attempt.status as Exclude<AttemptStatus, 'open'>])"
            />
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
          <p class="mt-2">
            {{ attempt.text }}
          </p>
          <ul class="mt-2 space-y-0.5 text-sm">
            <li
              v-for="(answer, index) in attempt.answers"
              :key="index"
            >
              <span class="text-ink-700">{{ answer.question }}</span>
              <span class="font-mono tabular ml-2">{{ answer.value }}</span>
              <span
                v-if="answer.wrongValues.length"
                class="ml-2 text-brick-700"
              >
                ({{ t('wrongTyped') }}: <span class="font-mono tabular">{{ answer.wrongValues.join(', ') }}</span>)
              </span>
            </li>
          </ul>
        </li>
      </ul>
    </section>
  </div>
</template>
