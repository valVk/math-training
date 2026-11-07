/**
 * Safe evaluator for the arithmetic expressions the generator returns as proof of each answer.
 * Supports numbers, + - * / and the school notations x, ×, ·, :, plus parentheses.
 * Throws on anything else. `onOperation` sees every multiplication and division with its operands,
 * so callers can check what a 3rd grader is expected to compute.
 */
export function evaluateExpression(
  source: string,
  onOperation?: (op: '*' | '/', left: number, right: number) => void
): number {
  const tokens = tokenize(source)
  let index = 0

  const peek = () => tokens[index]
  const next = () => tokens[index++]

  function parseExpression(): number {
    let value = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = next()
      const right = parseTerm()
      value = op === '+' ? value + right : value - right
    }
    return value
  }

  function parseTerm(): number {
    let value = parseFactor()
    while (peek() === '*' || peek() === '/') {
      const op = next()
      const right = parseFactor()
      if (op === '/' && right === 0) {
        throw new Error('Division by zero')
      }
      onOperation?.(op as '*' | '/', value, right)
      value = op === '*' ? value * right : value / right
    }
    return value
  }

  function parseFactor(): number {
    const token = next()
    if (token === '-') {
      return -parseFactor()
    }
    if (token === '(') {
      const value = parseExpression()
      if (next() !== ')') {
        throw new Error('Missing closing parenthesis')
      }
      return value
    }
    if (token !== undefined && /^\d+(\.\d+)?$/.test(token)) {
      return Number(token)
    }
    throw new Error(`Unexpected token: ${token ?? 'end of input'}`)
  }

  const result = parseExpression()
  if (index !== tokens.length) {
    throw new Error(`Unexpected token: ${peek()}`)
  }
  return result
}

function tokenize(source: string): string[] {
  const normalized = source
    .replace(/[x×·]/gi, '*')
    .replace(/:/g, '/')
    .replace(/,/g, '.')
  const tokens = normalized.match(/\d+(\.\d+)?|[+\-*/()]|\S/g) ?? []
  const invalid = tokens.find(token => !/^(\d+(\.\d+)?|[+\-*/()])$/.test(token))
  if (invalid) {
    throw new Error(`Invalid character: ${invalid}`)
  }
  return tokens
}

/** Parses what the child typed. Returns null when it is not a whole number. */
export function parseChildAnswer(input: string): number | null {
  const cleaned = input.replace(/\s+/g, '')
  if (!/^-?\d+$/.test(cleaned)) {
    return null
  }
  return Number(cleaned)
}
