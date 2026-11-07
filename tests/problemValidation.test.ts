import { describe, expect, it } from 'vitest'
import type { Problem } from '../shared/types'
import { findEquationDefect, findProblemDefect } from '../shared/utils/problemValidation'

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

describe('findEquationDefect', () => {
  it('accepts equations that hold for the answer, including units and expressions on the right', () => {
    expect(findEquationDefect('x + 37 = 468', 431)).toBeNull()
    expect(findEquationDefect('500 - x = 300', 200)).toBeNull()
    expect(findEquationDefect('67 + x = 213 + 54', 200)).toBeNull()
    expect(findEquationDefect('400 км + x км = 480 км', 80)).toBeNull()
  })

  it('rejects a wrong answer, a missing or doubled x, and a Cyrillic х', () => {
    expect(findEquationDefect('x - 342 = 656', 314)).toMatch(/does not hold/)
    expect(findEquationDefect('37 + 431 = 468', 431)).toMatch(/exactly one unknown/)
    expect(findEquationDefect('x + x = 10', 5)).toMatch(/exactly one unknown/)
    expect(findEquationDefect('х + 37 = 468', 431)).toMatch(/exactly one unknown/)
  })
})

describe('findProblemDefect by style', () => {
  const equationProblem: Problem = {
    text: { bg: 'Намери неизвестното число.', ru: 'Найди неизвестное число.' },
    hint: { bg: 'Неизвестното събираемо = сбор - събираемо.', ru: 'Неизвестное слагаемое = сумма - слагаемое.' },
    answers: [
      { question: { bg: 'x + 37 = 468', ru: 'x + 37 = 468' }, unit: { bg: '', ru: '' }, expression: '468 - 37', value: 431 },
      { question: { bg: 'x - 25 = 514 + 30', ru: 'x - 25 = 514 + 30' }, unit: { bg: '', ru: '' }, expression: '514 + 30 + 25', value: 569 }
    ]
  }

  it('lets equations skip the story length rule but checks each equation', () => {
    expect(findProblemDefect(equationProblem, 'equation')).toBeNull()
    expect(findProblemDefect(equationProblem, 'story')).toMatch(/story needs/)
    const wrong = { ...equationProblem, answers: [{ ...equationProblem.answers[0]!, expression: '468 + 37', value: 505 }] }
    expect(findProblemDefect(wrong, 'equation')).toMatch(/does not hold/)
  })

  it('accepts a short riddle that would be too short for a story', () => {
    const riddle = problem([{ expression: '145 + 312', value: 457 }])
    riddle.text = { bg: 'Разликата на две числа е 145. Умалителят е 312.', ru: 'Разность двух чисел 145. Вычитаемое 312.' }
    expect(findProblemDefect(riddle, 'riddle')).toBeNull()
    expect(findProblemDefect(riddle, 'story')).toMatch(/story needs/)
  })
})
