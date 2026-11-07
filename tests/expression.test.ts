import { describe, expect, it } from 'vitest'
import { evaluateExpression, parseChildAnswer } from '../shared/utils/expression'

describe('evaluateExpression', () => {
  it('respects operator precedence and parentheses', () => {
    expect(evaluateExpression('5 + 5 * 5')).toBe(30)
    expect(evaluateExpression('(72 - 12) / 6')).toBe(10)
  })

  it('accepts school notation for multiplication and division', () => {
    expect(evaluateExpression('124 x 3')).toBe(372)
    expect(evaluateExpression('8 × 7 · 1')).toBe(56)
    expect(evaluateExpression('96 : 4')).toBe(24)
  })

  it('rejects anything that is not arithmetic', () => {
    expect(() => evaluateExpression('process.exit()')).toThrow()
    expect(() => evaluateExpression('5 +')).toThrow()
    expect(() => evaluateExpression('(5 + 1')).toThrow()
    expect(() => evaluateExpression('10 / 0')).toThrow()
  })
})

describe('parseChildAnswer', () => {
  it('reads whole numbers with stray spaces', () => {
    expect(parseChildAnswer(' 1 000 ')).toBe(1000)
    expect(parseChildAnswer('25')).toBe(25)
  })

  it('returns null for non-numbers', () => {
    expect(parseChildAnswer('')).toBeNull()
    expect(parseChildAnswer('2.5')).toBeNull()
    expect(parseChildAnswer('пет')).toBeNull()
  })
})
