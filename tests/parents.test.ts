import { describe, expect, it } from 'vitest'
import { isParentLogin, parseParents } from '../server/utils/parents'

describe('parseParents', () => {
  it('reads email:password pairs, keeping colons inside passwords', () => {
    const parents = parseParents(' Mama@Example.com:se:cret , papa@example.com:1234 ')
    expect([...parents]).toEqual([
      ['mama@example.com', 'se:cret'],
      ['papa@example.com', '1234']
    ])
  })

  it('ignores malformed and empty entries', () => {
    expect(parseParents('').size).toBe(0)
    expect(parseParents('no-colon, :nopass-email, x@y.z:').size).toBe(0)
  })
})

describe('isParentLogin', () => {
  const parents = parseParents('mama@example.com:se:cret')

  it('accepts the right password, email case-insensitive', () => {
    expect(isParentLogin(parents, 'MAMA@example.com ', 'se:cret')).toBe(true)
  })

  it('rejects a wrong password or unknown email', () => {
    expect(isParentLogin(parents, 'mama@example.com', 'secret')).toBe(false)
    expect(isParentLogin(parents, 'child@example.com', 'se:cret')).toBe(false)
    expect(isParentLogin(parents, 'child@example.com', '\0')).toBe(false)
  })
})
