import { z } from 'zod'
import type { Problem } from '#shared/types'
import { findProblemType, type ProblemStyle } from '#shared/utils/problemTypes'
import { findProblemDefect } from '#shared/utils/problemValidation'

const BATCH_SIZE = 8

/**
 * Bump when the prompt changes what a problem looks like. Only problems of the current version are
 * served, so a stale pool is regenerated instead of shown.
 */
export const GENERATOR_VERSION = 3

const localized = z.object({
  bg: z.string().describe('Bulgarian'),
  ru: z.string().describe('Russian translation of the same text')
})

const batchSchema = z.object({
  problems: z.array(z.object({
    text: localized.describe('The problem text without the questions: the story, the riddle, or the instruction for equations'),
    hint: localized.describe('A gentle hint that points to the method without giving the number'),
    answers: z.array(z.object({
      question: localized.describe('The question for this answer, e.g. "Колко ябълки има Б?"; for equations the equation itself, e.g. "x + 37 = 468"'),
      unit: localized.describe('Unit word shown after the input box, e.g. "ябълки", "см", "евро"; empty string when none'),
      expression: z.string().describe('Arithmetic that produces the answer from numbers in the problem, using only digits, + - * / and parentheses'),
      value: z.number().describe('The answer, a non-negative whole number')
    }))
  }))
})

const SYSTEM_PROMPT = `You write math problems for a child in 3rd grade (age 9) at a Bulgarian school, following the Bulgarian 3rd grade curriculum and the style of the class workbook "Сборник по математика за 3. клас": whole numbers up to 1000.

The goal is reading comprehension as much as arithmetic, so problems are word problems unless the topic says it is about equations. Each request states the topic's style; follow the rules for that style.

Language: write natural, simple Bulgarian a 9-year-old reads easily. Provide an accurate Russian translation of every text field.
Notation follows Bulgarian textbooks: "." for multiplication (5 . 6), ":" for division, and the Latin letter "x" for an unknown number.
Use everyday Bulgarian contexts and names (Иван, Мария, Ники, Елена, баба, учителката...). Money is in euro and euro cents.

Each problem has 1 to 3 answers. When a problem has several answers, each one is its own question, asked in order, and later ones may build on earlier ones.
Every answer is a non-negative whole number. Its "expression" must compute it exactly from the numbers in the problem; the app re-computes it and discards the problem on any mismatch.
Vary numbers, contexts and wording; never repeat the examples you are shown.`

const STYLE_RULES: Record<ProblemStyle, string> = {
  story: `Style: story. Every problem is a short story of 2-5 sentences that the child must read and understand to work out what to calculate.
- Never write a bare computation such as "Пресметни: 345 + 232", "Пресметни писмено..." or "Колко е 6 . 7?". The numbers appear inside the story.
- Never name the operation in the text or the question (no "събери", "умножи", "раздели", "извади"). The child decides it from the meaning.
- Give characters, a place and a reason (a class trip, a bakery, a garden, a football match, grandma's village). Occasionally include one number that is not needed, so the child has to think about what matters.`,
  riddle: `Style: riddle. Every problem is a number riddle told in words, 1-3 sentences: a child describing their secret number, someone who thought of a number and did something with it, or a statement with math terms (сбор, събираемо, разлика, умаляемо, умалител, произведение, частно, "непосредствено преди/след").
- Never write the riddle as a numeric expression; the child has to translate the words into math.`,
  equation: `Style: equation. Every problem is one exercise "Намери неизвестното число." with 1-3 equations, one per answer.
- The problem text is exactly "Намери неизвестното число." (Russian: "Найди неизвестное число.").
- Each answer's question is one equation using the Latin letter x exactly once, written with digits, "+", "-", "=" and spaces only (units such as км, см are allowed after numbers), e.g. "x + 37 = 468", "67 + x = 213 + 54".
- The answer is the value of x; its expression computes x from the equation's numbers (e.g. "468 - 37"). The app substitutes the answer into the equation and discards it if both sides differ.
- The unit field is empty unless the equation uses units; the hint reminds how to find the unknown addend, minuend or subtrahend.`
}

/** Asks Claude for a batch of problems of one type and keeps only those that pass validation. */
export async function generateProblems(typeKey: string, recentTexts: string[]): Promise<Problem[]> {
  const type = findProblemType(typeKey)
  if (!type) {
    throw new Error(`Unknown problem type: ${typeKey}`)
  }

  const avoid = recentTexts.length
    ? `\n\nRecent problems of this type, do not repeat them:\n${recentTexts.map(text => `- ${text}`).join('\n')}`
    : ''

  const result = await askClaudeStructured({
    system: SYSTEM_PROMPT,
    schema: batchSchema,
    prompt: `Topic: ${type.title.bg} (${type.title.ru}).
${type.brief}

${STYLE_RULES[type.style]}

Examples in the style of the class workbook (match this style and difficulty; write new problems, never copy these):
${type.examples.map(example => `- ${example}`).join('\n')}

Write ${BATCH_SIZE} problems on this topic, ranging from easy to moderately challenging for 3rd grade.${avoid}`
  })

  const valid: Problem[] = []
  for (const problem of result.problems) {
    const defect = findProblemDefect(problem, type.style)
    if (defect) {
      console.warn(`[generator] discarded ${typeKey} problem: ${defect}`)
    } else {
      valid.push(problem)
    }
  }
  return valid
}
