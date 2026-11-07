<script setup lang="ts">
import type { AnalysisResult, TypeSetting } from '#shared/types'

const { t, pick } = useLocale(PARENT_LOCALE)
const toast = useToast()

const { data: saved, refresh } = await useFetch<TypeSetting[]>('/api/admin/types')
const items = ref<TypeSetting[]>([])
const saving = ref(false)

watch(saved, (value) => {
  items.value = (value ?? []).map(item => ({ ...item }))
}, { immediate: true })

const probabilities = computed(() => typeProbabilities(items.value.map((item, position) => ({ ...item, position }))))
const dirty = computed(() => JSON.stringify(items.value.map(i => [i.key, i.enabled]))
  !== JSON.stringify((saved.value ?? []).map(i => [i.key, i.enabled])))

function move(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= items.value.length) {
    return
  }
  const next = [...items.value]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  items.value = next
}

async function save() {
  saving.value = true
  try {
    await $fetch('/api/admin/types', {
      method: 'PUT',
      body: items.value.map(item => ({ key: item.key, enabled: item.enabled }))
    })
    await refresh()
    suggestion.value = null
    toast.add({ title: t('saved'), color: 'success' })
  } finally {
    saving.value = false
  }
}

function reset() {
  items.value = (saved.value ?? []).map(item => ({ ...item }))
  suggestion.value = null
}

/** Where each topic sits in the saved order, to show how far a suggestion moves it. */
const savedRank = computed(() => new Map((saved.value ?? []).map((item, index) => [item.key, index])))

const suggestion = ref<AnalysisResult | null>(null)
const suggesting = ref(false)
const days = ref(30)
const periodItems = computed(() => [
  { label: t('days7'), value: 7 },
  { label: t('days30'), value: 30 },
  { label: t('days90'), value: 90 },
  { label: t('days365'), value: 365 }
])

/**
 * Asks Claude to rank topics from the statistics and wrong answers, then rearranges the list.
 * Nothing is stored until the parent reviews it and presses Save.
 */
async function suggestOrder() {
  suggesting.value = true
  try {
    const result = await $fetch<AnalysisResult>('/api/admin/analyze', {
      method: 'POST',
      body: { days: days.value, locale: PARENT_LOCALE }
    })
    const byKey = new Map(items.value.map(item => [item.key, item]))
    items.value = result.suggestedOrder.flatMap((key) => {
      const item = byKey.get(key)
      return item ? [item] : []
    })
    suggestion.value = result
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    toast.add({ title: status === 409 ? t('noData') : t('suggestFailed'), color: 'error' })
  } finally {
    suggesting.value = false
  }
}

const insightFor = (key: string) => suggestion.value?.perType.find(item => item.typeKey === key)
const verdictColor = { easy: 'success', ok: 'neutral', hard: 'error' } as const
const verdictLabel = { easy: 'verdictEasy', ok: 'verdictOk', hard: 'verdictHard' } as const

const typeTitle = (key: string) => {
  const type = findProblemType(key)
  return type ? pick(type.title) : key
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="font-display text-3xl">
      {{ t('typesTitle') }}
    </h1>
    <p class="mt-2 text-ink-600">
      {{ t('typesText') }}
    </p>

    <section class="mt-6 rounded-lg border border-ink-200 bg-ink-50/60 p-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="max-w-md">
          <h2 class="font-display text-xl">
            {{ t('suggestTitle') }}
          </h2>
          <p class="mt-1 text-sm text-ink-600">
            {{ t('suggestText') }}
          </p>
        </div>
        <div class="flex items-end gap-3">
          <UFormField :label="t('period')">
            <USelect
              v-model="days"
              :items="periodItems"
              class="w-32"
            />
          </UFormField>
          <UButton
            icon="i-lucide-sparkles"
            :loading="suggesting"
            :label="suggesting ? t('analyzing') : t('suggestButton')"
            @click="suggestOrder"
          />
        </div>
      </div>

      <div
        v-if="suggestion"
        class="mt-5 space-y-3 border-t border-ink-200 pt-4"
      >
        <p class="leading-relaxed">
          {{ suggestion.summary }}
        </p>
        <ul class="list-disc space-y-1 pl-5 text-sm text-ink-700">
          <li
            v-for="step in suggestion.nextSteps"
            :key="step"
          >
            {{ step }}
          </li>
        </ul>
        <p class="text-sm italic text-brass-700">
          {{ t('suggestApplied') }}
        </p>
      </div>
    </section>

    <ol class="mt-6 divide-y divide-ink-200 rounded-lg border border-ink-200 bg-ink-50/60">
      <li
        v-for="(item, index) in items"
        :key="item.key"
        class="flex items-center gap-3 px-4 py-3"
        :class="item.enabled ? '' : 'opacity-50'"
      >
        <span class="font-display w-6 text-right text-lg text-clay-600 tabular">{{ index + 1 }}</span>
        <div class="flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span>{{ typeTitle(item.key) }}</span>
            <UBadge
              v-if="insightFor(item.key)"
              :color="verdictColor[insightFor(item.key)!.verdict]"
              variant="subtle"
              :label="t(verdictLabel[insightFor(item.key)!.verdict])"
            />
            <span
              v-if="suggestion && savedRank.get(item.key) !== index"
              class="text-xs tabular"
              :class="(savedRank.get(item.key) ?? index) > index ? 'text-moss-700' : 'text-brick-700'"
            >
              {{ (savedRank.get(item.key) ?? index) > index ? '↑' : '↓' }}{{ Math.abs((savedRank.get(item.key) ?? index) - index) }}
            </span>
          </div>
          <p
            v-if="insightFor(item.key)"
            class="mt-0.5 text-sm text-ink-600"
          >
            {{ insightFor(item.key)!.note }}
          </p>
        </div>
        <span
          class="w-14 text-right text-sm text-ink-600 tabular"
          :title="t('chance')"
        >
          {{ item.enabled ? formatPercent(probabilities[item.key] ?? 0) : '-' }}
        </span>
        <div class="flex">
          <UButton
            icon="i-lucide-chevron-up"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="index === 0"
            :aria-label="t('moveUp')"
            @click="move(index, -1)"
          />
          <UButton
            icon="i-lucide-chevron-down"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="index === items.length - 1"
            :aria-label="t('moveDown')"
            @click="move(index, 1)"
          />
        </div>
        <USwitch
          v-model="item.enabled"
          color="success"
        />
      </li>
    </ol>

    <div class="mt-6 flex items-center justify-end gap-4">
      <span
        v-if="dirty"
        class="text-sm italic text-brass-700"
      >{{ t('unsaved') }}</span>
      <UButton
        v-if="dirty || suggestion"
        color="neutral"
        variant="ghost"
        :label="t('reset')"
        @click="reset"
      />
      <UButton
        :label="t('save')"
        :loading="saving"
        :disabled="!dirty"
        @click="save"
      />
    </div>
  </div>
</template>
