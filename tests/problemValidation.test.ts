import { describe, expect, it } from 'vitest'
import type { Problem } from '../shared/types'
import { findProblemDefect } from '../shared/utils/problemValidation'

const text = {
  bg: 'Ива набра 5 ябълки в градината на баба. Брат ѝ Боби набра 5 пъти повече ябълки от нея.',
  ru: 'Ива собрала 5 яблок в саду у бабушки. Её брат Боби собрал в 5 раз больше яблок, чем она.'
}
const unit = { bg: 'ябълки', ru: 'яблок' }

function problem(answers: Array<{ expression: string, value: number }>): Problem {
  return {
    text,
    hint: text,
    answers: answers.map(answer => ({ ...answer, question: text, unit }))
  }
}

describe('findProblemDefect', () => {
  it('accepts a correct multi-answer problem', () => {
    expect(findProblemDefect(problem([
      { expression: '5 * 5', value: 25 },
      { expression: '5 + 5 * 5', value: 30 }
    ]))).toBeNull()
  })

  it('catches a stated value that disagrees with its expression', () => {
    expect(findProblemDefect(problem([{ expression: '5 + 5', value: 25 }]))).toMatch(/expression gives 10/)
  })

  it('rejects fractional and negative answers', () => {
    expect(findProblemDefect(problem([{ expression: '7 / 2', value: 3.5 }]))).toMatch(/whole number/)
    expect(findProblemDefect(problem([{ expression: '3 - 5', value: -2 }]))).toMatch(/whole number/)
  })

  it('rejects bare computations without a story', () => {
    const bare = problem([{ expression: '345 + 232', value: 577 }])
    bare.text = { bg: 'Пресметни писмено: 345 + 232', ru: 'Вычисли письменно: 345 + 232' }
    expect(findProblemDefect(bare)).toMatch(/story needs/)
  })

  it('requires 1 to 3 answers', () => {
    expect(findProblemDefect(problem([]))).toMatch(/1-3 answers/)
  })
})
