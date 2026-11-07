import type { Problem } from '../types'
import { evaluateExpression } from './expression'
import type { ProblemStyle } from './problemTypes'

const MAX_ANSWER = 100000
/** Below this many words the text is a bare computation, not something to read and understand. */
const MIN_WORDS: Record<ProblemStyle, number> = { story: 12, riddle: 8, equation: 0 }
/** Signs that the generator corrected itself mid-text ("изкопал половината... всъщност"), leaving an ambiguous story. */
const SELF_CORRECTION = /\.\.\.|…|всъщност/i
/** A class name with a bare letter ("3 а клас") reads like a quantity; it must be written 3 „А“ клас. */
const BARE_CLASS_LETTER = /\d\s*[а-я]\s+клас/i
/** 3rd grade multiplies and divides by a one-digit number or by 10. */
const MAX_SMALL_OPERAND = 10

export interface DefectOptions {
  /** The topic is about multiplying and dividing by numbers greater than 10. */
  multiDigit?: boolean
}

/**
 * Checks every multiplication and division in an answer's expression: division must be exact and,
 * unless the topic allows bigger operands, one factor and the divisor must be at most 10.
 */
function findOperationDefect(expression: string, options: DefectOptions): string | null {
  let defect: string | null = null
  evaluateExpression(expression, (op, left, right) => {
    if (defect) {
      return
    }
    if (op === '/' && !Number.isInteger(left / right)) {
      defect = `${left} : ${right} is not exact`
    } else if (!options.multiDigit && op === '/' && right > MAX_SMALL_OPERAND) {
      defect = `divides by ${right}, more than 3rd grade covers`
    } else if (!options.multiDigit && op === '*' && Math.min(left, right) > MAX_SMALL_OPERAND) {
      defect = `multiplies ${left} . ${right}, more than 3rd grade covers`
    }
  })
  return defect
}

/**
 * Checks an equation question such as "x + 37 = 468" or "400 км + x км = 480 км": substitutes the
 * answer for x and requires both sides to be equal. Returns a reason when it does not hold.
 */
export function findEquationDefect(equation: string, value: number): string | null {
  const unknowns = equation.match(/x/gi) ?? []
  if (unknowns.length !== 1) {
    return `"${equation}" must contain exactly one unknown x`
  }
  const sides = equation.split('=')
  if (sides.length !== 2) {
    return `"${equation}" must contain exactly one "="`
  }
  // Drop unit words (км, см, ...) and put the answer in place of x before evaluating.
  const [left, right] = sides.map(side => side
    .replace(/[a-wyzа-яё]+\.?/gi, ' ')
    .replace(/x/gi, `(${value})`))
  try {
    const leftValue = evaluateExpression(left!)
    const rightValue = evaluateExpression(right!)
    if (Math.abs(leftValue - rightValue) > 1e-9) {
      return `"${equation}" does not hold for x = ${value} (${leftValue} vs ${rightValue})`
    }
  } catch (error) {
    return `"${equation}" is not a valid equation (${(error as Error).message})`
  }
  return null
}

/**
 * Re-computes every answer from its expression and rejects problems where the generator's
 * stated value disagrees, or where the result is not a non-negative whole number. Multiplication and
 * division are limited to what the topic covers. Equations are additionally checked by substituting
 * the answer. Returns a reason string, or null when fine.
 */
export function findProblemDefect(problem: Problem, style: ProblemStyle = 'story', options: DefectOptions = {}): string | null {
  if (problem.answers.length < 1 || problem.answers.length > 3) {
    return `expected 1-3 answers, got ${problem.answers.length}`
  }
  if (!problem.text.bg.trim() || !problem.text.ru.trim()) {
    return 'empty problem text'
  }
  const words = problem.text.bg.trim().split(/\s+/).length
  if (words < MIN_WORDS[style]) {
    return `text has ${words} words, a ${style} needs at least ${MIN_WORDS[style]}`
  }
  const wording = [problem.text.bg, ...problem.answers.map(answer => answer.question.bg)]
  if (wording.some(part => SELF_CORRECTION.test(part))) {
    return 'text corrects itself ("..." or "всъщност")'
  }
  if (wording.some(part => BARE_CLASS_LETTER.test(part))) {
    return 'class letter without quotes ("3 а клас" instead of 3 „А“ клас)'
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
    const operationDefect = findOperationDefect(answer.expression, options)
    if (operationDefect) {
      return `answer ${index + 1}: ${operationDefect}`
    }
    if (style === 'equation') {
      const defect = findEquationDefect(answer.question.bg, answer.value)
      if (defect) {
        return `answer ${index + 1}: ${defect}`
      }
    }
  }
  return null
}
