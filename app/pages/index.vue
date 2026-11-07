<script setup lang="ts">
import type { AttemptEvent, AttemptStatus, PublicProblem } from '#shared/types'

const { t, pick } = useLocale(CHILD_LOCALE)
const { t: tParent } = useLocale(PARENT_LOCALE)
const timer = useActiveTimer()

const problem = ref<PublicProblem | null>(null)
const loading = ref(false)
const slow = ref(false)
const failed = ref(false)
const finishedStatus = ref<AttemptStatus | null>(null)
const showTranslation = ref(false)
const showHint = ref(false)

const typeTitle = computed(() => {
  const type = problem.value ? findProblemType(problem.value.typeKey) : undefined
  return type ? pick(type.title) : ''
})

async function loadNext() {
  loading.value = true
  failed.value = false
  finishedStatus.value = null
  const slowTimer = setTimeout(() => (slow.value = true), 4000)
  try {
    const next = await $fetch<PublicProblem>('/api/problems/next')
    problem.value = next
    showTranslation.value = next.translationOpened
    showHint.value = next.hintUsed
    timer.start(next.activeMs)
  } catch {
    failed.value = true
  } finally {
    clearTimeout(slowTimer)
    slow.value = false
    loading.value = false
  }
}

function attemptUrl(action: string) {
  return `/api/attempts/${problem.value!.attemptId}/${action}`
}

function onFinished(status: AttemptStatus) {
  if (status !== 'open') {
    timer.stop()
    finishedStatus.value = status
  }
}

async function submitAnswer(answerIndex: number, value: string) {
  const result = await $fetch<{ correct: boolean, invalid: boolean, canReveal: boolean, status: AttemptStatus }>(
    attemptUrl('check'),
    { method: 'POST', body: { answerIndex, value, activeMs: timer.read() } }
  )
  onFinished(result.status)
  return result
}

async function revealAnswer(answerIndex: number) {
  const result = await $fetch<{ value: number, status: AttemptStatus }>(
    attemptUrl('reveal'),
    { method: 'POST', body: { answerIndex, activeMs: timer.read() } }
  )
  onFinished(result.status)
  return result.value
}

async function track(type: AttemptEvent) {
  await $fetch(attemptUrl('event'), { method: 'POST', body: { type, activeMs: timer.read() } })
}

function toggleTranslation() {
  showTranslation.value = !showTranslation.value
  if (showTranslation.value && !problem.value!.translationOpened) {
    problem.value!.translationOpened = true
    track('translation')
  }
}

function openHint() {
  showHint.value = true
  if (!problem.value!.hintUsed) {
    problem.value!.hintUsed = true
    track('hint')
  }
}

const { loggedIn } = useUserSession()
const skipOpen = ref(false)

async function skip() {
  await $fetch(attemptUrl('skip'), { method: 'POST', body: { activeMs: timer.read() } })
  timer.stop()
  await loadNext()
}

/** A signed-in parent skips at once; otherwise the parent signs in first, once per device. */
function requestSkip() {
  if (loggedIn.value) {
    return skip()
  }
  skipOpen.value = true
}

async function onParentLogin() {
  skipOpen.value = false
  await skip()
}

onMounted(loadNext)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <div
      v-if="loading"
      class="notebook rounded-lg border border-ink-200 p-10 text-center"
    >
      <UIcon
        name="i-lucide-pencil-line"
        class="size-8 animate-pulse text-clay-500"
      />
      <p class="mt-4 text-xl text-ink-700 md:text-2xl">
        {{ t('preparing') }}
      </p>
      <p
        v-if="slow"
        class="mt-2 text-base italic text-ink-500 md:text-lg"
      >
        {{ t('preparingSlow') }}
      </p>
    </div>

    <div
      v-else-if="failed"
      class="rounded-lg border border-brick-200 bg-brick-50 p-8 text-center"
    >
      <p class="text-xl text-brick-800">
        {{ t('loadFailed') }}
      </p>
      <UButton
        class="mt-4"
        size="xl"
        :label="t('retry')"
        @click="loadNext"
      />
    </div>

    <article
      v-else-if="problem"
      :key="problem.attemptId"
      class="notebook rounded-lg border border-ink-200 p-6 shadow-[4px_4px_0_var(--color-ink-200)] sm:p-10"
    >
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-col gap-2">
          <span class="text-base uppercase tracking-[0.15em] text-clay-700">{{ typeTitle }}</span>
          <span
            v-if="problem.returning"
            class="flex items-center gap-1.5 text-base text-brass-700"
          >
            <UIcon
              name="i-lucide-rotate-ccw"
              class="size-4"
            />
            {{ t('returning') }}
          </span>
        </div>
        <div class="flex gap-2">
          <UButton
            size="lg"
            color="neutral"
            variant="outline"
            icon="i-lucide-languages"
            :label="showTranslation ? t('hideTranslation') : t('showTranslation')"
            @click="toggleTranslation"
          />
          <UButton
            v-if="!showHint"
            size="lg"
            color="secondary"
            variant="outline"
            icon="i-lucide-lightbulb"
            :label="t('hint')"
            @click="openHint"
          />
        </div>
      </header>

      <p class="mt-6 text-2xl leading-relaxed text-ink-950 md:text-[2rem] md:leading-relaxed">
        {{ problem.text.bg }}
      </p>
      <p
        v-if="showTranslation"
        class="mt-4 border-l-2 border-ink-300 pl-4 text-xl leading-relaxed italic text-ink-600 md:text-2xl"
      >
        {{ problem.text.ru }}
      </p>

      <div
        v-if="showHint"
        class="mt-6 flex gap-3 rounded-md border border-brass-200 bg-brass-50 px-5 py-4 text-xl leading-relaxed text-brass-900 md:text-2xl"
      >
        <UIcon
          name="i-lucide-lightbulb"
          class="mt-1.5 size-6 shrink-0"
        />
        <div>
          <p>{{ problem.hint.bg }}</p>
          <p
            v-if="showTranslation"
            class="mt-1 italic text-brass-800"
          >
            {{ problem.hint.ru }}
          </p>
        </div>
      </div>

      <div class="mt-8 space-y-5">
        <AnswerField
          v-for="(answer, index) in problem.answers"
          :key="index"
          :index="index"
          :question="answer.question"
          :unit="answer.unit"
          :solved="problem.solved[index] ?? false"
          :show-translation="showTranslation"
          :submit="value => submitAnswer(index, value)"
          :reveal="() => revealAnswer(index)"
        />
      </div>

      <footer class="mt-8 flex items-center justify-between gap-4">
        <template v-if="finishedStatus">
          <p class="font-display text-3xl text-moss-700">
            {{ finishedStatus === 'solved' ? t('wellDone') : t('doneWithReveal') }}
          </p>
          <UButton
            size="xl"
            trailing-icon="i-lucide-arrow-right"
            :label="t('next')"
            @click="loadNext"
          />
        </template>
        <UButton
          v-else
          class="ml-auto"
          size="lg"
          color="neutral"
          variant="ghost"
          :label="t('skip')"
          @click="requestSkip"
        />
      </footer>
    </article>

    <UModal
      v-model:open="skipOpen"
      :title="tParent('skipTitle')"
      :description="tParent('skipText')"
    >
      <template #body>
        <ParentLoginForm @success="onParentLogin">
          <template #actions>
            <UButton
              color="neutral"
              variant="ghost"
              size="lg"
              :label="tParent('cancel')"
              @click="skipOpen = false"
            />
          </template>
        </ParentLoginForm>
      </template>
    </UModal>
  </div>
</template>
