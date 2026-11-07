import type { TypeSetting } from '../types'

/**
 * Linear priority: among N enabled types the top one gets weight N, the bottom one weight 1.
 * Returns selection probabilities keyed by type, enabled types only.
 */
export function typeProbabilities(settings: TypeSetting[]): Record<string, number> {
  const enabled = settings
    .filter(setting => setting.enabled)
    .sort((a, b) => a.position - b.position)
  const count = enabled.length
  const total = (count * (count + 1)) / 2
  const result: Record<string, number> = {}
  enabled.forEach((setting, rank) => {
    result[setting.key] = (count - rank) / total
  })
  return result
}

/** Picks a type key using the linear priority weights. `random` is injectable for tests. */
export function pickWeightedType(settings: TypeSetting[], random: () => number = Math.random): string | null {
  const probabilities = Object.entries(typeProbabilities(settings))
  if (probabilities.length === 0) {
    return null
  }
  let roll = random()
  for (const [key, probability] of probabilities) {
    roll -= probability
    if (roll < 0) {
      return key
    }
  }
  return probabilities[probabilities.length - 1]![0]
}
