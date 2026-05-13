// Cost estimation + usage logging for Claude API calls.
// Prices are in cents per million tokens (so cost in DB is fractional cents).

const PRICING_PER_MTOK = {
  // Haiku 4.5 — $1/M input, $5/M output
  'claude-haiku-4-5-20251001': { input: 100, output: 500 },
  'claude-haiku-4-5':          { input: 100, output: 500 },
  // Sonnet 4.6 — $3/M input, $15/M output
  'claude-sonnet-4-6':         { input: 300, output: 1500 },
  'claude-sonnet-4-5':         { input: 300, output: 1500 },
  // Opus 4.7 — $15/M input, $75/M output
  'claude-opus-4-7':           { input: 1500, output: 7500 },
}

const DEFAULT_PRICE = { input: 300, output: 1500 } // assume Sonnet pricing if model unknown

export function estimateCostCents(model, inputTokens, outputTokens) {
  const p = PRICING_PER_MTOK[model] || DEFAULT_PRICE
  return ((inputTokens || 0) / 1_000_000) * p.input + ((outputTokens || 0) / 1_000_000) * p.output
}

export async function logAiUsage(supabase, { feature, model, usage }) {
  if (!supabase || !usage) return
  const inputTokens = usage.input_tokens || 0
  const outputTokens = usage.output_tokens || 0
  const cents = estimateCostCents(model, inputTokens, outputTokens)
  try {
    await supabase.from('v2_ai_usage').insert({
      feature,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_cents: cents,
    })
  } catch (err) {
    // Usage logging failures should NEVER break the user-facing AI flow.
    console.error('logAiUsage failed:', err.message || err)
  }
}
