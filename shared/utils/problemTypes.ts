import type { LocalizedText } from '../types'

/**
 * How a topic's problems are written:
 * - story: a 2-5 sentence situation the child has to read and understand (the main format);
 * - riddle: a short number riddle in words, using terms like сбор, умалител, "непосредствено преди";
 * - equation: "Намери неизвестното число" with one to three equations a ± b = c, unknown written as x.
 */
export type ProblemStyle = 'story' | 'riddle' | 'equation'

export interface ProblemTypeDef {
  key: string
  title: LocalizedText
  style: ProblemStyle
  /** Instructions for the generator, in English for prompt precision. */
  brief: string
  /**
   * Style samples modelled on the child's textbook ("Сборник по математика за 3. клас"),
   * with changed numbers and names. Shown to the generator as style, never to be copied.
   */
  examples: string[]
}

/** Topics of the Bulgarian 3rd grade math curriculum. Array order is the default priority. */
export const PROBLEM_TYPES: ProblemTypeDef[] = [
  {
    key: 'more_less_by',
    title: { bg: 'С повече / с по-малко', ru: 'На сколько больше / меньше' },
    style: 'story',
    brief: 'Story with "с N повече" / "с N по-малко", or asking "с колко повече". Usually 2 answers: the second quantity, then the total.',
    examples: [
      'В една книжарница продали 240 тетрадки и с 35 повече химикалки. Въпроси: Колко химикалки продали? Колко тетрадки и химикалки общо продали?',
      'Ново кафене украсили със 120 бели балона и с 40 по-малко червени балона. Въпроси: Колко са червените балони? Колко балона общо са използвали за украсата?'
    ]
  },
  {
    key: 'add_sub_1000',
    title: { bg: 'Събиране и изваждане до 1000', ru: 'Сложение и вычитание до 1000' },
    style: 'story',
    brief: 'Story solved by adding or subtracting numbers within 1000. Favour the textbook pattern "a whole made of several parts, find the missing part" (… а останалите са …), and "how many altogether" with 3-4 parts.',
    examples: [
      'В цветна леха засадили 465 луковици лалета. От тях 120 били жълти, 112 червени, 131 бели, а останалите – розови. Въпрос: Колко луковици розови лалета засадили?',
      'В закрит паркинг на три етажа има 360 паркоместа. На първия етаж има 140 места, а на втория – 120. Въпрос: Колко паркоместа има на третия етаж?'
    ]
  },
  {
    key: 'equations',
    title: { bg: 'Уравнения: a ± b = c', ru: 'Уравнения: a ± b = c' },
    style: 'equation',
    brief: 'Equations with addition and subtraction within 1000. Mix the forms x + b = c, a + x = c, x - b = c, a - x = c, and harder ones with an expression on the right side (67 + x = 213 + 54, x - 25 = 514 + 30, x + 143 = 578 - 204). Sometimes add units on every number (400 км + x км = 480 км).',
    examples: [
      'Текст: Намери неизвестното число. Въпроси: x + 37 = 468 | 135 + x = 587 | x - 342 = 656',
      'Текст: Намери неизвестното число. Въпроси: 67 + x = 213 + 54 | x - 25 = 514 + 30',
      'Текст: Намери неизвестното число. Въпроси: 400 км + x км = 480 км | x км - 300 км = 30 км'
    ]
  },
  {
    key: 'unknown_number',
    title: { bg: 'Неизвестно число в задача', ru: 'Неизвестное число в задаче' },
    style: 'story',
    brief: 'Story where the starting amount is unknown and is found by reversing what happened (had some, gave/ate/sold some, some were left; or received more and now has some).',
    examples: [
      'Мечо Пух имал в килера си бурканчета с мед. Изял 27 от тях и му останали 136. Въпрос: Колко бурканчета с мед е имал Пух първоначално?',
      'Кристофър имал стъклени и пластмасови топчета. Подарил на Пух 14 стъклени и 18 пластмасови топчета и му останали 125. Въпрос: Колко топчета е имал Кристофър първоначално?'
    ]
  },
  {
    key: 'number_riddles',
    title: { bg: 'Намислено число', ru: 'Задуманное число' },
    style: 'riddle',
    brief: 'Number riddles told in words: a child describes a secret number, someone thinks of a number and does something with it, or a statement uses the terms сбор, събираемо, разлика, умаляемо, умалител, произведение, частно, "непосредствено преди/след", "с N по-голямо", "N пъти по-малко".',
    examples: [
      'Ани казва: Моето число е 3 пъти по-голямо от разликата на числата 47 и 39. Въпрос: Кое е числото на Ани?',
      'Петър намислил едно число. Прибавил към него 315 и получил числото, което е непосредствено преди 900. Въпрос: Кое число е намислил Петър?',
      'Разликата на две числа е 145. Умалителят е 312. Въпрос: Колко е умаляемото?'
    ]
  },
  {
    key: 'times_more_less',
    title: { bg: 'Пъти повече / пъти по-малко', ru: 'В несколько раз больше / меньше' },
    style: 'story',
    brief: 'Story where one quantity is "N пъти повече" or "N пъти по-малко" than another, often compared with a sum of two other quantities. Prefer 2-3 answers: the second quantity, the total, and "с колко повече".',
    examples: [
      'В конкурс за най-добра рисунка участвали 8 второкласници и 4 пъти повече третокласници. Въпроси: Колко са третокласниците? Колко общо са участниците? С колко третокласниците са повече от второкласниците?',
      'В парка засадили 14 бели и 16 червени рози, а жълтите рози били 3 пъти по-малко от белите и червените заедно. Въпрос: Колко жълти рози засадили?'
    ]
  },
  {
    key: 'multi_step_word',
    title: { bg: 'Съставни текстови задачи', ru: 'Составные текстовые задачи' },
    style: 'story',
    brief: 'Story that needs 2-3 operations, typically a chain of "с N повече / по-малко от …" quantities followed by a total. Ask for intermediate results as separate answers when natural.',
    examples: [
      'През есента в една ферма засадили 150 ябълкови дръвчета, с 40 повече от ябълковите – крушови, със 110 по-малко от крушовите – сливови, и 60 черешови дръвчета. Въпрос: Колко дръвчета общо засадили?',
      'В склада на магазин има 130 бурканчета сладко от ягоди, с 25 повече – от боровинки, и със 105 по-малко от общия брой на ягодовите и боровинковите – от малини. Въпрос: Колко са бурканчетата сладко от малини?'
    ]
  },
  {
    key: 'perimeter',
    title: { bg: 'Обиколка на фигури', ru: 'Периметр фигур' },
    style: 'story',
    brief: 'Story about a real place or object shaped as a triangle, square or rectangle (a fence, a park, a drawing on the asphalt, a greenhouse): find the perimeter, a side from another side ("3 пъти по-дълга", "с 24 м по-дълга"), a missing side from the perimeter, or the base of an isosceles triangle.',
    examples: [
      'За рисунка на асфалта Лея оградила място с форма на правоъгълник. Едната страна е 8 дм, а другата е 3 пъти по-дълга. Въпроси: Колко дециметра е другата страна? Колко дециметра е обиколката на огражденото място?',
      'Мия тренира в парк, който има форма на правоъгълник. Обиколката на парка е 90 м, а едната му страна е 30 м. Въпрос: Колко метра е другата страна?'
    ]
  },
  {
    key: 'measurement_units',
    title: { bg: 'Мерни единици и разстояния', ru: 'Единицы измерения и расстояния' },
    style: 'story',
    brief: 'Story with mm, cm, dm, m, km; g, kg; ml, l; minutes, hours, days. Include distance stories (routes through several places, two vehicles leaving in opposite directions). Always ask for a whole number in a stated unit.',
    examples: [
      'От две села, които са на 185 км едно от друго, едновременно в противоположни посоки тръгнали камион и лека кола. След два часа камионът изминал 118 км, а колата – 135 км. Въпрос: На какво разстояние един от друг са двамата след два часа?',
      'Мама имала панделка, дълга 3 м. Отрязала от нея 120 см за подарък на баба. Въпрос: Колко сантиметра панделка останаха?'
    ]
  },
  {
    key: 'money',
    title: { bg: 'Задачи с пари', ru: 'Задачи с деньгами' },
    style: 'story',
    brief: 'Shopping and change story in euro (евро) and euro cents (евроцента); Bulgaria uses the euro. Typical: a cheaper or more expensive second item, the total, and the change from banknotes. Keep every answer a whole number of euro or of cents, and state which.',
    examples: [
      'Алиса купила нов скейтборд за 64 евро и предпазна каска, която била с 39 евро по-евтина от скейтборда. Тя платила с 2 банкноти от 50 евро. Въпроси: Колко струва каската? Колко евро струва цялата покупка? Колко евро ресто получила Алиса?'
    ]
  },
  {
    key: 'mult_table',
    title: { bg: 'Таблично умножение', ru: 'Табличное умножение' },
    style: 'story',
    brief: 'Story whose solution is a multiplication table fact up to 10 . 10 (equal groups). The text never says "multiply".',
    examples: [
      'В часа по физическо учителката разделила класа на 6 отбора. Във всеки отбор имало по 4 деца. Въпрос: Колко деца играли?'
    ]
  },
  {
    key: 'div_table',
    title: { bg: 'Таблично деление', ru: 'Табличное деление' },
    style: 'story',
    brief: 'Story whose solution is a division fact inverse to the multiplication table: sharing equally or grouping. The text never says "divide".',
    examples: [
      'Учителката донесла 48 цветни молива и ги раздала по равно на 8 деца от групата по рисуване. Въпрос: По колко молива получило всяко дете?'
    ]
  },
  {
    key: 'mult_beyond_table',
    title: { bg: 'Извънтаблично умножение', ru: 'Внетабличное умножение' },
    style: 'story',
    brief: 'Story whose solution multiplies a 2- or 3-digit number by a 1-digit number (equal groups), possibly followed by an addition or subtraction. No division anywhere: no sharing, halves, "пъти по-малко" or questions answered by dividing. Results within 1000.',
    examples: [
      'В една кутия има 124 кламера. Секретарката купила 3 такива кутии за училищната канцелария. Въпрос: Колко кламера купила?',
      'Училищният автобус прави по 4 курса на ден. При всеки курс вози по 36 деца. Въпрос: Колко деца превозва автобусът за един ден?'
    ]
  },
  {
    key: 'div_beyond_table',
    title: { bg: 'Извънтаблично деление', ru: 'Внетабличное деление' },
    style: 'story',
    brief: 'Story whose solution divides a 2- or 3-digit number by a 1-digit number without remainder (sharing equally or grouping). The text never says "divide".',
    examples: [
      'В пекарната изпекли 96 кифли и ги подредили по равно в 4 тави. Въпрос: По колко кифли има във всяка тава?'
    ]
  },
  {
    key: 'order_of_operations',
    title: { bg: 'Числови изрази и ред на действията', ru: 'Числовые выражения и порядок действий' },
    style: 'story',
    brief: 'Story whose solution, written as one numeric expression, needs 2-3 operations with the right order or brackets. The expression field holds that combined expression.',
    examples: [
      'Ники купил 5 тетрадки по 6 евро всяка и платил с банкнота от 50 евро. Въпрос: Колко евро ресто получил Ники?'
    ]
  },
  {
    key: 'part_of_number',
    title: { bg: 'Част от число', ru: 'Часть числа' },
    style: 'story',
    brief: 'Story asking for a half, a third, a quarter, a fifth or a tenth of a quantity. Results are whole numbers.',
    examples: [
      'Баба набрала 36 ябълки от градината. Една четвърт от тях били червени, а останалите – жълти. Въпроси: Колко червени ябълки набрала баба? Колко са жълтите ябълки?'
    ]
  },
  {
    key: 'roman_numerals',
    title: { bg: 'Римски цифри', ru: 'Римские цифры' },
    style: 'story',
    brief: 'Story where Roman numerals I to XXX appear naturally (a clock face, book chapters, centuries) and the child finds a value or does one simple operation. The answer is always the Arabic number.',
    examples: [
      'Книгата за приключения на Ники има XIV глави. Досега той прочел IX от тях и иска да я завърши през ваканцията. Въпрос: Колко глави още трябва да прочете?'
    ]
  }
]

export const PROBLEM_TYPE_KEYS = PROBLEM_TYPES.map(type => type.key)

export function findProblemType(key: string): ProblemTypeDef | undefined {
  return PROBLEM_TYPES.find(type => type.key === key)
}
