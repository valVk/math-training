import type { LocalizedText } from '../types'

export interface ProblemTypeDef {
  key: string
  title: LocalizedText
  /** Instructions for the generator, in English for prompt precision. */
  brief: string
}

/**
 * Topics of the Bulgarian 3rd grade math curriculum. Every topic is practiced through word problems,
 * never bare computations, so the child has to read and understand the text. Array order is the default priority.
 */
export const PROBLEM_TYPES: ProblemTypeDef[] = [
  {
    key: 'times_more_less',
    title: { bg: 'Пъти повече / пъти по-малко', ru: 'В несколько раз больше / меньше' },
    brief: 'Story where one quantity is "N пъти повече" or "N пъти по-малко" than another. Prefer 2-3 answers, e.g. how many the second one has, then how many together or the difference.'
  },
  {
    key: 'more_less_by',
    title: { bg: 'С повече / с по-малко', ru: 'На сколько больше / меньше' },
    brief: 'Story with "с N повече" / "с N по-малко", or asking "с колко повече". Often 2 answers: the second quantity, then the total.'
  },
  {
    key: 'multi_step_word',
    title: { bg: 'Съставни текстови задачи', ru: 'Составные текстовые задачи' },
    brief: 'Story that needs 2-3 operations (mix of +, -, ., :) to answer. Ask for intermediate results as separate answers when natural.'
  },
  {
    key: 'add_sub_1000',
    title: { bg: 'Събиране и изваждане до 1000', ru: 'Сложение и вычитание до 1000' },
    brief: 'Story whose solution is addition or subtraction of 2- and 3-digit numbers within 1000, with and without carrying (e.g. a library had 345 books and received 232 more). The child decides whether to add or subtract from the meaning of the text.'
  },
  {
    key: 'mult_table',
    title: { bg: 'Таблично умножение', ru: 'Табличное умножение' },
    brief: 'Story whose solution is a multiplication table fact up to 10 . 10 (e.g. 6 boxes with 7 pencils each). The text describes equal groups; it never says "multiply".'
  },
  {
    key: 'div_table',
    title: { bg: 'Таблично деление', ru: 'Табличное деление' },
    brief: 'Story whose solution is a division fact inverse to the multiplication table: sharing equally or grouping (e.g. 56 cherries shared among 8 children). The text never says "divide".'
  },
  {
    key: 'mult_div_beyond_table',
    title: { bg: 'Извънтаблично умножение и деление', ru: 'Внетабличное умножение и деление' },
    brief: 'Story whose solution multiplies a 2- or 3-digit number by a 1-digit number (e.g. 124 . 3), or divides a 2- or 3-digit number by a 1-digit number without remainder (e.g. 96 : 4). Results within 1000.'
  },
  {
    key: 'order_of_operations',
    title: { bg: 'Числови изрази и ред на действията', ru: 'Числовые выражения и порядок действий' },
    brief: 'Story whose solution, written as one numeric expression, needs 2-3 operations with the right order or brackets (e.g. buying 5 notebooks at 6 euro each and paying with a 50 euro note). The expression field holds that combined expression.'
  },
  {
    key: 'unknown_number',
    title: { bg: 'Неизвестно число', ru: 'Неизвестное число' },
    brief: 'Story where a starting or missing quantity is unknown and must be found by reversing an operation (e.g. "Ани имаше няколко стикера. Подари 25 и ѝ останаха 40. Колко стикера имаше?"). The expression computes the unknown.'
  },
  {
    key: 'measurement_units',
    title: { bg: 'Мерни единици', ru: 'Единицы измерения' },
    brief: 'Story using mm, cm, dm, m, km; g, kg; ml, l; minutes, hours, days, weeks (e.g. a ribbon 2 m long is cut into 4 equal pieces, how many cm is each). Always ask for a whole number in a stated unit.'
  },
  {
    key: 'perimeter',
    title: { bg: 'Обиколка на фигури', ru: 'Периметр фигур' },
    brief: 'Story about a real object or place shaped as a triangle, square or rectangle (a garden fence, a picture frame, a playground), asking for the perimeter or a missing side from the perimeter. Lengths in cm, dm or m.'
  },
  {
    key: 'money',
    title: { bg: 'Задачи с пари', ru: 'Задачи с деньгами' },
    brief: 'Shopping and change story in euro (евро) and euro cents (евроцента); Bulgaria uses the euro. Keep every answer a whole number of euro or of cents, and state which.'
  },
  {
    key: 'part_of_number',
    title: { bg: 'Част от число', ru: 'Часть числа' },
    brief: 'Story asking for a half, a third, a quarter, a fifth or a tenth of a quantity (e.g. a quarter of 36 apples were red). Results are whole numbers.'
  },
  {
    key: 'roman_numerals',
    title: { bg: 'Римски цифри', ru: 'Римские цифры' },
    brief: 'Story where Roman numerals I to XXX appear naturally (a clock face, book chapters, centuries, a monument\'s date) and the child finds a value or does one simple operation. The answer is always the Arabic number.'
  }
]

export const PROBLEM_TYPE_KEYS = PROBLEM_TYPES.map(type => type.key)

export function findProblemType(key: string): ProblemTypeDef | undefined {
  return PROBLEM_TYPES.find(type => type.key === key)
}
