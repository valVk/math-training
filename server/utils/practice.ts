import type { AnswerProgress, AttemptEvent, AttemptStatus, Problem, PublicProblem, TypeSetting } from '#shared/types'
import { pickWeightedType } from '#shared/utils/weights'
import { parseChildAnswer } from '#shared/utils/expression'

/**
 * The child practices without signing in (only parents sign in), so all attempts belong to one learner.
 * Attempts keep a learner column so per-child tracking can return later without a migration.
 */
export const LEARNER = 'local'

/** Refill a type's pool in the background once a learner has this few unseen problems left. */
const REFILL_THRESHOLD = 3
/** Open attempts older than this are closed as abandoned instead of being resumed. */
const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000
/** Wrong tries on one answer before the child may reveal it. */
export const TRIES_BEFORE_REVEAL = 3
/** A skipped problem comes back after the child has started this many other problems. */
const RETURN_AFTER = 3

interface AttemptRow {
  id: number
  problem_id: number
  type_key: string
  user_email: string
  served_at: number
  status: AttemptStatus
  active_ms: number
  answers: string
  hint_used: number
  translation_opened: number
  is_return: number
}

const refills = new Map<string, Promise<void>>()

export function loadTypeSettings(): TypeSetting[] {
  const rows = useDb()
    .prepare('SELECT type_key, position, enabled FROM type_settings ORDER BY position')
    .all() as Array<{ type_key: string, position: number, enabled: number }>
  return rows
    .filter(row => findProblemType(row.type_key))
    .map(row => ({ key: row.type_key, position: row.position, enabled: row.enabled === 1 }))
}

function unseenCount(typeKey: string, learner: string): number {
  const row = useDb().prepare(`
    SELECT COUNT(*) AS count FROM problems p
    WHERE p.type_key = ? AND p.generator_version = ? AND NOT EXISTS (
      SELECT 1 FROM attempts a WHERE a.problem_id = p.id AND a.user_email = ?
    )`).get(typeKey, GENERATOR_VERSION, learner) as { count: number }
  return row.count
}

function pickUnseenProblem(typeKey: string, learner: string): { id: number, data: string } | undefined {
  return useDb().prepare(`
    SELECT p.id, p.data FROM problems p
    WHERE p.type_key = ? AND p.generator_version = ? AND NOT EXISTS (
      SELECT 1 FROM attempts a WHERE a.problem_id = p.id AND a.user_email = ?
    )
    ORDER BY RANDOM() LIMIT 1`).get(typeKey, GENERATOR_VERSION, learner) as { id: number, data: string } | undefined
}

/**
 * Problems whose latest attempt was skipped or abandoned, i.e. not solved since. They keep coming back
 * until solved. Disabled topics and outdated generator versions are left out.
 */
const PENDING_RETURNS_SQL = `
  FROM attempts a
  JOIN problems p ON p.id = a.problem_id
  JOIN type_settings s ON s.type_key = p.type_key AND s.enabled = 1
  WHERE a.user_email = @learner
    AND a.status IN ('skipped', 'abandoned')
    AND p.generator_version = @version
    AND a.id = (SELECT MAX(b.id) FROM attempts b WHERE b.problem_id = a.problem_id AND b.user_email = a.user_email)`

export function countPendingReturns(learner: string): number {
  const row = useDb().prepare(`SELECT COUNT(*) AS count ${PENDING_RETURNS_SQL}`)
    .get({ learner, version: GENERATOR_VERSION }) as { count: number }
  return row.count
}

/** The oldest skipped problem that the child has moved past by at least RETURN_AFTER problems. */
function pickReturningProblem(learner: string): { id: number, data: string } | undefined {
  return useDb().prepare(`SELECT p.id, p.data ${PENDING_RETURNS_SQL}
      AND (SELECT COUNT(*) FROM attempts c WHERE c.user_email = a.user_email AND c.id > a.id) >= @gap
    ORDER BY a.id LIMIT 1`)
    .get({ learner, version: GENERATOR_VERSION, gap: RETURN_AFTER }) as { id: number, data: string } | undefined
}

/** Generates and stores a batch for a type; concurrent calls for the same type share one request. */
export function refillPool(typeKey: string): Promise<void> {
  const pending = refills.get(typeKey)
  if (pending) {
    return pending
  }
  const task = (async () => {
    const db = useDb()
    const recent = (db.prepare('SELECT data FROM problems WHERE type_key = ? AND generator_version = ? ORDER BY id DESC LIMIT 15')
      .all(typeKey, GENERATOR_VERSION) as Array<{ data: string }>)
      .map((row) => {
        // Include the questions: for equations the text is always the same instruction.
        const problem = JSON.parse(row.data) as Problem
        return [problem.text.bg, ...problem.answers.map(answer => answer.question.bg)].join(' | ')
      })
    const problems = await generateProblems(typeKey, recent)
    const insert = db.prepare('INSERT INTO problems (type_key, data, created_at, generator_version) VALUES (?, ?, ?, ?)')
    const now = Date.now()
    db.transaction(() => {
      for (const problem of problems) {
        insert.run(typeKey, JSON.stringify(problem), now, GENERATOR_VERSION)
      }
    })()
  })().finally(() => refills.delete(typeKey))
  refills.set(typeKey, task)
  return task
}

function toPublic(row: AttemptRow, problem: Problem): PublicProblem {
  const progress = JSON.parse(row.answers) as AnswerProgress[]
  return {
    attemptId: row.id,
    typeKey: row.type_key,
    text: problem.text,
    hint: problem.hint,
    answers: problem.answers.map(answer => ({ question: answer.question, unit: answer.unit })),
    solved: progress.map(item => item.solvedAtMs !== null || item.revealed),
    hintUsed: row.hint_used === 1,
    translationOpened: row.translation_opened === 1,
    activeMs: row.active_ms,
    returning: row.is_return === 1
  }
}

function loadProblem(problemId: number): Problem {
  const row = useDb().prepare('SELECT data FROM problems WHERE id = ?').get(problemId) as { data: string }
  return JSON.parse(row.data) as Problem
}

export async function nextProblemFor(learner: string): Promise<PublicProblem> {
  const db = useDb()
  const now = Date.now()

  db.prepare(`UPDATE attempts SET status = 'abandoned' WHERE user_email = ? AND status = 'open' AND served_at < ?`)
    .run(learner, now - RESUME_WINDOW_MS)
  const open = db.prepare(`SELECT * FROM attempts WHERE user_email = ? AND status = 'open' ORDER BY id DESC LIMIT 1`)
    .get(learner) as AttemptRow | undefined
  if (open) {
    return toPublic(open, loadProblem(open.problem_id))
  }

  const returning = pickReturningProblem(learner)
  if (returning) {
    return startAttempt(returning, learner, true)
  }

  const settings = loadTypeSettings()
  const typeKey = pickWeightedType(settings)
  if (!typeKey) {
    throw createError({ statusCode: 409, statusMessage: 'No problem types are enabled' })
  }

  let picked = pickUnseenProblem(typeKey, learner)
  if (!picked) {
    try {
      await refillPool(typeKey)
    } catch (error) {
      console.error(`[practice] refill of ${typeKey} failed`, error)
    }
    picked = pickUnseenProblem(typeKey, learner)
  }
  if (!picked) {
    // Fall back to any enabled type that still has unseen problems.
    for (const setting of settings.filter(item => item.enabled && item.key !== typeKey)) {
      picked = pickUnseenProblem(setting.key, learner)
      if (picked) {
        break
      }
    }
  }
  if (!picked) {
    throw createError({ statusCode: 503, statusMessage: 'Could not prepare a problem, try again' })
  }

  const pickedType = (db.prepare('SELECT type_key FROM problems WHERE id = ?').get(picked.id) as { type_key: string }).type_key
  if (unseenCount(pickedType, learner) <= REFILL_THRESHOLD) {
    refillPool(pickedType).catch(error => console.error(`[practice] background refill of ${pickedType} failed`, error))
  }
  return startAttempt(picked, learner, false)
}

function startAttempt(picked: { id: number, data: string }, learner: string, isReturn: boolean): PublicProblem {
  const db = useDb()
  const problem = JSON.parse(picked.data) as Problem
  const typeKey = (db.prepare('SELECT type_key FROM problems WHERE id = ?').get(picked.id) as { type_key: string }).type_key
  const progress: AnswerProgress[] = problem.answers.map(() => ({ tries: 0, wrongValues: [], solvedAtMs: null, revealed: false }))
  const result = db.prepare(`INSERT INTO attempts (problem_id, type_key, user_email, served_at, answers, is_return)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(picked.id, typeKey, learner, Date.now(), JSON.stringify(progress), isReturn ? 1 : 0)
  const row = db.prepare('SELECT * FROM attempts WHERE id = ?').get(result.lastInsertRowid) as AttemptRow
  return toPublic(row, problem)
}

function loadOpenAttempt(attemptId: number, learner: string): AttemptRow {
  const row = useDb().prepare('SELECT * FROM attempts WHERE id = ? AND user_email = ?').get(attemptId, learner) as AttemptRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Attempt not found' })
  }
  if (row.status !== 'open') {
    throw createError({ statusCode: 409, statusMessage: 'Attempt is already finished' })
  }
  return row
}

function saveProgress(row: AttemptRow, progress: AnswerProgress[], activeMs: number) {
  const done = progress.every(item => item.solvedAtMs !== null || item.revealed)
  const status: AttemptStatus = done ? (progress.some(item => item.revealed) ? 'revealed' : 'solved') : 'open'
  useDb().prepare('UPDATE attempts SET answers = ?, active_ms = ?, status = ?, finished_at = ? WHERE id = ?')
    .run(JSON.stringify(progress), Math.max(row.active_ms, activeMs), status, done ? Date.now() : null, row.id)
  return { finished: done, status }
}

function answerIndexOrThrow(progress: AnswerProgress[], answerIndex: number): AnswerProgress {
  const item = progress[answerIndex]
  if (!item) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid answer index' })
  }
  return item
}

export function checkAnswer(attemptId: number, learner: string, answerIndex: number, input: string, activeMs: number) {
  const row = loadOpenAttempt(attemptId, learner)
  const problem = loadProblem(row.problem_id)
  const progress = JSON.parse(row.answers) as AnswerProgress[]
  const item = answerIndexOrThrow(progress, answerIndex)
  if (item.solvedAtMs !== null || item.revealed) {
    throw createError({ statusCode: 409, statusMessage: 'Answer already completed' })
  }

  const value = parseChildAnswer(input)
  if (value === null) {
    // Not a number at all: tell the child without counting it as a try.
    return { correct: false, invalid: true, canReveal: item.tries >= TRIES_BEFORE_REVEAL, finished: false, status: 'open' as AttemptStatus }
  }

  item.tries++
  const correct = value === problem.answers[answerIndex]!.value
  if (correct) {
    item.solvedAtMs = activeMs
  } else {
    item.wrongValues.push(value)
  }
  return { correct, invalid: false, canReveal: !correct && item.tries >= TRIES_BEFORE_REVEAL, ...saveProgress(row, progress, activeMs) }
}

export function revealAnswer(attemptId: number, learner: string, answerIndex: number, activeMs: number) {
  const row = loadOpenAttempt(attemptId, learner)
  const problem = loadProblem(row.problem_id)
  const progress = JSON.parse(row.answers) as AnswerProgress[]
  const item = answerIndexOrThrow(progress, answerIndex)
  if (item.tries < TRIES_BEFORE_REVEAL) {
    throw createError({ statusCode: 409, statusMessage: 'Try a few more times first' })
  }
  item.revealed = true
  return { value: problem.answers[answerIndex]!.value, ...saveProgress(row, progress, activeMs) }
}

export function recordEvent(attemptId: number, learner: string, type: AttemptEvent, activeMs: number) {
  const row = loadOpenAttempt(attemptId, learner)
  const column = type === 'hint' ? 'hint_used' : 'translation_opened'
  useDb().prepare(`UPDATE attempts SET ${column} = 1, active_ms = ? WHERE id = ?`)
    .run(Math.max(row.active_ms, activeMs), row.id)
}

export function skipAttempt(attemptId: number, learner: string, activeMs: number) {
  const row = loadOpenAttempt(attemptId, learner)
  useDb().prepare(`UPDATE attempts SET status = 'skipped', active_ms = ?, finished_at = ? WHERE id = ?`)
    .run(Math.max(row.active_ms, activeMs), Date.now(), row.id)
}
