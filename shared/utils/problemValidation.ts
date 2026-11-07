import type { Problem } from '../types'
import { evaluateExpression } from './expression'

const MAX_ANSWER = 100000
/** A story has to give the child something to read; shorter texts are bare computations. */
const MIN_STORY_WORDS = 12

/**
 * Re-computes every answer from its expression and rejects problems where the generator's
 * stated value disagrees, or where the result is not a non-negative whole number.
 * Returns a reason string when the problem is invalid, null when it is fine.
 */
export function findProblemDefect(problem: Problem): string | null {
  if (problem.answers.length < 1 || problem.answers.length > 3) {
    return `expected 1-3 answers, got ${problem.answers.length}`
  }
  if (!problem.text.bg.trim() || !problem.text.ru.trim()) {
    return 'empty problem text'
  }
  const words = problem.text.bg.trim().split(/\s+/).length
  if (words < MIN_STORY_WORDS) {
    return `text has ${words} words, a story needs at least ${MIN_STORY_WORDS}`
  }
  for (const [index, answer] of problem.answers.entries()) {
    let computed: number
    try {
      computed = evaluateExpression(answer.expression)
    } catch (error) {
      return `answer ${index + 1}: bad expression "${answer.expression}" (${(error as Error).message})`
    }
    if (Math.abs(computed - answer.value) > 1e-9) {
      return `answer ${index + 1}: expression gives ${computed}, stated ${answer.value}`
    }
    if (!Number.isInteger(computed) || computed < 0 || computed > MAX_ANSWER) {
      return `answer ${index + 1}: ${computed} is not a whole number in range`
    }
  }
  return null
}
