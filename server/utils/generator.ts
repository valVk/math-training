import { z } from 'zod'
import type { Problem } from '#shared/types'
import { findProblemType, type ProblemStyle } from '#shared/utils/problemTypes'
import { findProblemDefect } from '#shared/utils/problemValidation'

const BATCH_SIZE = 8

/**
 * Bump when the prompt changes what a problem looks like. Only problems of the current version are
 * served, so a stale pool is regenerated instead of shown.
 */
export const GENERATOR_VERSION = 4

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
A school class is written with the letter capitalised in Bulgarian quotes, e.g. 3 „А“ клас (Russian: 3 «А» класс), never "3 а клас", so the class number cannot be mistaken for a quantity.

Each problem has 1 to 3 answers. When a problem has several answers, each one is its own question, asked in order, and later ones may build on earlier ones.
Every answer is a non-negative whole number. Its "expression" must compute it exactly from the numbers in the problem; the app re-computes it and discards the problem on any mismatch.
Vary numbers, contexts and wording; never repeat the examples you are shown.

Every text is final, printed-workbook copy. Never think aloud or correct yourself inside a text: no "всъщност", no "...", no changed plans, no events that are taken back.
Each problem is one self-contained situation about the same characters; never put sentences from different problems into one text.
All numbers in a story must agree with each other: if a whole and its parts are given, the parts add up to the whole; never state a fact that the answer then contradicts (e.g. 420 spectators of whom 180 women and 330 men). Give only the numbers the situation needs, plus at most one clearly unrelated extra.
A comparison refers to a quantity in the same story ("с 90 по-малко от жените"), never to the total it is part of.
A problem must have exactly one reading. Do not mention an action that changes a quantity (ate, sold, dug up, gave away half) unless the questions take it into account; an extra unneeded number must clearly be about something the questions do not ask. Before you output a problem, re-read it as the child would: using only the text, they must reach exactly the stated answers.`

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

const OPERAND_RULE = `Multiplication and division: a 3rd grader only multiplies or divides by a one-digit number or by 10. In every problem one factor of each multiplication is at most 10, every divisor is at most 10, and every division is exact. This applies to the story itself too: never share 200 sheets among 25 children or buy 12 packs of 15. The app re-checks the expression and discards violations.`

const MULTI_DIGIT_RULE = `Multiplication and division: this topic is about multiplying two numbers greater than 10 or dividing by a two-digit number; every problem needs at least one such step. Every division is exact.`

const reviewSchema = z.object({
  reviews: z.array(z.object({
    index: z.number().int().describe('The problem number as given, starting at 0'),
    ok: z.boolean(),
    reason: z.string().describe('Short reason when not ok, empty otherwise')
  }))
})

const REVIEW_PROMPT = `You are a 3rd grade teacher at a Bulgarian school checking word problems before a 9-year-old sees them. The arithmetic of each answer has already been verified by a program; you check everything a program cannot.

Reject a problem (ok: false) when any of these is true:
- The text is not one coherent situation: sentences from different stories, a sentence that has nothing to do with the questions, a story that changes its mind or contradicts itself.
- The numbers contradict each other: compute every quantity the story implies and check that it is consistent (parts that do not add up to the stated whole, a group described as smaller than a total it should be part of, a stated total that differs from the sum of its parts).
- A question cannot be answered from the text alone, or a careful child could reasonably arrive at a different answer than the stated one (ambiguous wording, an action that seems to change a quantity but is ignored, missing information).
- The stated expression does not match what the story describes (e.g. the story shares among 4 but the expression multiplies by 4).
- The Bulgarian is unnatural or wrong for a 9-year-old, or the Russian translation says something different.
- The problem does not fit the stated topic.
Accept (ok: true) everything else; do not reject for style preferences. Review every problem.`

/**
 * A second, independent read of the batch. The validator checks numbers only; this catches
 * problems that compute correctly but make no sense as a story (e.g. two stories glued together).
 */
async function reviewProblems(topic: string, problems: Problem[]): Promise<Problem[]> {
  if (problems.length === 0) {
    return problems
  }
  const listing = problems.map((problem, index) => JSON.stringify({
    index,
    text: problem.text,
    answers: problem.answers.map(answer => ({ question: answer.question, unit: answer.unit, expression: answer.expression, value: answer.value }))
  })).join('\n')
  const { reviews } = await askClaudeStructured({
    system: REVIEW_PROMPT,
    schema: reviewSchema,
    prompt: `Topic: ${topic}\n\nProblems, one JSON object per line:\n${listing}`
  })
  const verdicts = new Map(reviews.map(review => [review.index, review]))
  return problems.filter((problem, index) => {
    const review = verdicts.get(index)
    // A problem the reviewer skipped is not trusted.
    if (!review?.ok) {
      console.warn(`[generator] review rejected a problem: ${review?.reason || 'not reviewed'} | ${problem.text.bg}`)
      return false
    }
    return true
  })
}

/**
 * Asks Claude for a batch of problems of one type and keeps only those that pass validation and
 * the review.
 */
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

${type.multiDigit ? MULTI_DIGIT_RULE : OPERAND_RULE}

Examples in the style of the class workbook (match this style and difficulty; write new problems, never copy these):
${type.examples.map(example => `- ${example}`).join('\n')}

Write ${BATCH_SIZE} problems on this topic, ranging from easy to moderately challenging for 3rd grade.${avoid}`
  })

  const valid: Problem[] = []
  for (const problem of result.problems) {
    const defect = findProblemDefect(problem, type.style, { multiDigit: type.multiDigit })
    if (defect) {
      console.warn(`[generator] discarded ${typeKey} problem: ${defect}`)
    } else {
      valid.push(problem)
    }
  }
  return reviewProblems(`${type.title.bg} (${type.title.ru}): ${type.brief}`, valid)
}
