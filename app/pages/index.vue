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
const showTeacher = ref(false)
/**
 * Every problem first appears behind a "show the problem" button: the clock starts only when the
 * child actually sits down to it, and a problem left untouched for an hour hides again.
 */
const shown = ref(false)
const hiddenAfterBreak = ref(false)
const HIDE_AFTER_IDLE_MS = 60 * 60 * 1000

const problemType = computed(() => problem.value ? findProblemType(problem.value.typeKey) : undefined)
const typeTitle = computed(() => problemType.value ? pick(problemType.value.title) : '')

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
    showTeacher.value = false
    shown.value = false
    hiddenAfterBreak.value = false
    // Resumed attempts continue from the time already spent; the clock runs only once shown.
    timer.stop()
    timer.activeMs.value = next.activeMs
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

/** A parent can skip the problem from the parent page; then the child moves on to the next one. */
function isFinishedElsewhere(error: unknown) {
  return (error as { statusCode?: number }).statusCode === 409
    && (error as { statusMessage?: string }).statusMessage === 'Attempt is already finished'
}

async function attemptCall<T>(action: string, body: Record<string, unknown>): Promise<T> {
  try {
    return await $fetch<T>(attemptUrl(action), { method: 'POST', body }) as T
  } catch (error) {
    if (isFinishedElsewhere(error)) {
      timer.stop()
      loadNext()
    }
    throw error
  }
}

async function checkFinishedElsewhere() {
  if (!problem.value || loading.value || finishedStatus.value) {
    return
  }
  const attemptId = problem.value.attemptId
  const { status } = await $fetch<{ status: AttemptStatus }>(`/api/attempts/${attemptId}/status`)
  if (status !== 'open' && problem.value?.attemptId === attemptId && !finishedStatus.value) {
    timer.stop()
    await loadNext()
  }
}
usePolling(() => checkFinishedElsewhere().catch(() => {}))

function onFinished(status: AttemptStatus) {
  if (status !== 'open') {
    timer.stop()
    finishedStatus.value = status
  }
}

async function submitAnswer(answerIndex: number, value: string) {
  const result = await attemptCall<{ correct: boolean, invalid: boolean, canReveal: boolean, status: AttemptStatus }>(
    'check',
    { answerIndex, value, activeMs: timer.read() }
  )
  onFinished(result.status)
  return result
}

async function revealAnswer(answerIndex: number) {
  const result = await attemptCall<{ value: number, status: AttemptStatus }>(
    'reveal',
    { answerIndex, activeMs: timer.read() }
  )
  onFinished(result.status)
  return result.value
}

async function track(type: AttemptEvent) {
  await attemptCall('event', { type, activeMs: timer.read() })
}

function toggleTranslation() {
  showTranslation.value = !showTranslation.value
  if (showTranslation.value && !problem.value!.translationOpened) {
    problem.value!.translationOpened = true
    track('translation')
  }
}

/** The topic's general method, never this problem's solution; it can be opened and closed again. */
function toggleTeacher() {
  showTeacher.value = !showTeacher.value
  if (showTeacher.value && !problem.value!.teacherUsed) {
    problem.value!.teacherUsed = true
    track('teacher')
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
  try {
    await $fetch(attemptUrl('skip'), { method: 'POST', body: { activeMs: timer.read() } })
  } catch (error) {
    if (!isFinishedElsewhere(error)) {
      throw error
    }
  }
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

async function showProblem() {
  shown.value = true
  hiddenAfterBreak.value = false
  timer.start(timer.activeMs.value)
  await attemptCall('start', {})
}

/**
 * After an hour without input the problem hides. The server then closes it as not solved if it was
 * partly answered (a new problem comes), or keeps it if nothing was answered yet (same problem,
 * behind the button again).
 */
async function hideIfIdle() {
  if (shown.value && !finishedStatus.value && timer.inputIdleMs() > HIDE_AFTER_IDLE_MS) {
    timer.stop()
    shown.value = false
    const previous = problem.value?.attemptId
    await loadNext()
    hiddenAfterBreak.value = problem.value?.attemptId === previous
  }
}
// Also runs right when the tab becomes visible again, e.g. the tablet waking up the next morning.
usePolling(hideIfIdle, 30_000)

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

    <div
      v-else-if="problem && !shown"
      class="notebook rounded-lg border border-ink-200 p-10 text-center shadow-[4px_4px_0_var(--color-ink-200)] sm:p-14"
    >
      <p class="text-base uppercase tracking-[0.15em] text-clay-700">
        {{ typeTitle }}
      </p>
      <p class="mt-4 text-2xl text-ink-800 md:text-[2rem]">
        {{ hiddenAfterBreak ? t('hiddenAfterBreak') : t('problemReady') }}
      </p>
      <UButton
        class="mt-8"
        size="xl"
        icon="i-lucide-book-open"
        :label="t('showProblem')"
        :ui="{ base: 'px-8 py-4 text-2xl', leadingIcon: 'size-7' }"
        @click="showProblem"
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
          <UButton
            v-if="problemType"
            size="lg"
            color="success"
            :variant="showTeacher ? 'subtle' : 'outline'"
            icon="i-lucide-graduation-cap"
            :label="t('teacher')"
            @click="toggleTeacher"
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

      <div
        v-if="showTeacher && problemType"
        class="mt-6 rounded-md border border-moss-200 bg-moss-50 px-5 py-4 text-xl leading-relaxed text-moss-950 md:text-2xl"
      >
        <p class="flex items-center gap-2 font-display text-moss-800">
          <UIcon
            name="i-lucide-graduation-cap"
            class="size-6 shrink-0"
          />
          {{ t('teacherTitle') }}
        </p>
        <p class="mt-2 whitespace-pre-line">
          {{ problemType.theory.bg }}
        </p>
        <p
          v-if="showTranslation"
          class="mt-3 whitespace-pre-line border-l-2 border-moss-300 pl-4 italic text-moss-800"
        >
          {{ problemType.theory.ru }}
        </p>
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
