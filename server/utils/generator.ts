import { z } from 'zod'
import type { Problem } from '#shared/types'
import { findProblemType } from '#shared/utils/problemTypes'
import { findProblemDefect } from '#shared/utils/problemValidation'

const BATCH_SIZE = 8

/**
 * Bump when the prompt changes what a problem looks like. Only problems of the current version are
 * served, so a stale pool is regenerated instead of shown.
 */
export const GENERATOR_VERSION = 2

const localized = z.object({
  bg: z.string().describe('Bulgarian'),
  ru: z.string().describe('Russian translation of the same text')
})

const batchSchema = z.object({
  problems: z.array(z.object({
    text: localized.describe('The story: 2-5 sentences describing the situation, without the questions'),
    hint: localized.describe('A gentle hint that points to the method without giving the number'),
    answers: z.array(z.object({
      question: localized.describe('The question for this answer, e.g. "Колко ябълки има Б?"'),
      unit: localized.describe('Unit word shown after the input box, e.g. "ябълки", "см", "евро"; empty string when none'),
      expression: z.string().describe('Arithmetic that produces the answer from numbers in the problem, using only digits, + - * / and parentheses'),
      value: z.number().describe('The answer, a non-negative whole number')
    }))
  }))
})

const SYSTEM_PROMPT = `You write math word problems for a child in 3rd grade (age 9) at a Bulgarian school, following the Bulgarian 3rd grade curriculum: whole numbers up to 1000.

Every problem is a short story of 2-5 sentences that the child must read and understand to work out what to calculate. The goal is reading comprehension as much as arithmetic:
- Never write a bare computation such as "Пресметни: 345 + 232", "Пресметни писмено..." or "Колко е 6 . 7?". The numbers appear inside the story.
- Never name the operation in the text or the question (no "събери", "умножи", "раздели", "извади"). The child decides it from the meaning.
- Give characters, a place and a reason (a class trip, a bakery, a garden, a football match, grandma's village). Occasionally include one number that is not needed, so the child has to think about what matters.

Language: write natural, simple Bulgarian a 9-year-old reads easily. Provide an accurate Russian translation of every text field.
Notation in the problem text follows Bulgarian textbooks: "." for multiplication (5 . 6), ":" for division, "х" for an unknown number.
Use everyday Bulgarian contexts and names (Иван, Мария, Ники, Елена, баба, учителката...). Money is in euro and euro cents.

Each problem has 1 to 3 answers. When a problem has several answers, each one is its own question, asked in order, and later ones may build on earlier ones.
Every answer is a non-negative whole number. Its "expression" must compute it exactly from the numbers in the problem; the app re-computes it and discards the problem on any mismatch.
Vary numbers, contexts and wording; never repeat the examples you are shown.`

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

Write ${BATCH_SIZE} problems on this topic, ranging from easy to moderately challenging for 3rd grade.${avoid}`
  })

  const valid: Problem[] = []
  for (const problem of result.problems) {
    const defect = findProblemDefect(problem)
    if (defect) {
      console.warn(`[generator] discarded ${typeKey} problem: ${defect}`)
    } else {
      valid.push(problem)
    }
  }
  return valid
}
