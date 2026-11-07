export type Locale = 'bg' | 'ru'

export interface LocalizedText {
  bg: string
  ru: string
}

/** One sub-question of a problem; a problem has 1-3 of them. */
export interface ProblemAnswer {
  question: LocalizedText
  unit: LocalizedText
  /** Arithmetic expression the value is computed from, e.g. "5 + 5 * 5". */
  expression: string
  value: number
}

export interface Problem {
  text: LocalizedText
  hint: LocalizedText
  answers: ProblemAnswer[]
}

/** What the child's browser receives: everything except the solutions. */
export interface PublicProblem {
  attemptId: number
  typeKey: string
  text: LocalizedText
  hint: LocalizedText
  answers: Array<{ question: LocalizedText, unit: LocalizedText }>
  /** Progress restored when an open attempt is resumed after a reload. */
  solved: boolean[]
  hintUsed: boolean
  translationOpened: boolean
  activeMs: number
  /** The child skipped this problem earlier and it has come back. */
  returning: boolean
}

export type AttemptStatus = 'open' | 'solved' | 'skipped' | 'revealed' | 'abandoned'

export interface AnswerProgress {
  tries: number
  wrongValues: number[]
  /** Active milliseconds into the attempt when this answer was solved. */
  solvedAtMs: number | null
  revealed: boolean
}

export type AttemptEvent = 'hint' | 'translation'

export interface TypeSetting {
  key: string
  position: number
  enabled: boolean
}

export interface TypeStats {
  typeKey: string
  attempts: number
  solved: number
  skipped: number
  revealed: number
  firstTryRate: number | null
  medianActiveMs: number | null
  avgTries: number | null
  hintRate: number | null
  translationRate: number | null
}

export interface RecentAttempt {
  id: number
  typeKey: string
  servedAt: number
  status: AttemptStatus
  activeMs: number
  text: string
  answers: Array<{ question: string, value: number, tries: number, wrongValues: number[], revealed: boolean }>
  hintUsed: boolean
  translationOpened: boolean
  isReturn: boolean
}

export interface StatsResponse {
  /** Skipped problems not solved yet; they will come back to the child. */
  pendingReturns: number
  types: TypeStats[]
  recent: RecentAttempt[]
}

export interface AnalysisResult {
  summary: string
  perType: Array<{ typeKey: string, verdict: 'easy' | 'ok' | 'hard', note: string }>
  suggestedOrder: string[]
  nextSteps: string[]
}
