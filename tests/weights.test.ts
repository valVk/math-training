import { describe, expect, it } from 'vitest'
import { pickWeightedType, typeProbabilities } from '../shared/utils/weights'

const settings = [
  { key: 'a', position: 0, enabled: true },
  { key: 'off', position: 1, enabled: false },
  { key: 'b', position: 2, enabled: true },
  { key: 'c', position: 3, enabled: true }
]

describe('typeProbabilities', () => {
  it('gives linear weights to enabled types only', () => {
    const probabilities = typeProbabilities(settings)
    expect(probabilities).toEqual({ a: 3 / 6, b: 2 / 6, c: 1 / 6 })
    expect(probabilities.off).toBeUndefined()
  })
})

describe('pickWeightedType', () => {
  it('maps the random roll onto the weight ranges', () => {
    expect(pickWeightedType(settings, () => 0)).toBe('a')
    expect(pickWeightedType(settings, () => 0.6)).toBe('b')
    expect(pickWeightedType(settings, () => 0.99)).toBe('c')
  })

  it('returns null when nothing is enabled', () => {
    expect(pickWeightedType([{ key: 'a', position: 0, enabled: false }])).toBeNull()
  })
})
