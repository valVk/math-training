import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'

let client: Anthropic | null = null

function useClaude(): Anthropic {
  if (!client) {
    const { anthropicApiKey } = useRuntimeConfig()
    if (!anthropicApiKey) {
      throw createError({ statusCode: 500, statusMessage: 'NUXT_ANTHROPIC_API_KEY is not set' })
    }
    client = new Anthropic({ apiKey: anthropicApiKey })
  }
  return client
}

/**
 * One structured-output request. The server-side fallback re-runs a request declined by the
 * safety classifiers on Anthropic's recommended fallback model instead of failing.
 */
export async function askClaudeStructured<Schema extends z.ZodType>(options: {
  system: string
  prompt: string
  schema: Schema
  effort?: 'low' | 'medium' | 'high'
}): Promise<z.infer<Schema>> {
  const { anthropicModel } = useRuntimeConfig()
  const response = await useClaude().beta.messages.parse({
    model: anthropicModel,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: options.system,
    messages: [{ role: 'user', content: options.prompt }],
    output_config: {
      effort: options.effort ?? 'medium',
      format: betaZodOutputFormat(options.schema)
    }
  })

  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined the request (${response.stop_details?.category ?? 'unknown'})`)
  }
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
    throw new Error(`Claude returned no usable output (stop_reason: ${response.stop_reason})`)
  }
  return response.parsed_output as z.infer<Schema>
}
