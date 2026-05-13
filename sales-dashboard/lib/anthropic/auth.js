// Centralised Claude client resolution.
// Priority:
//   1. User-configured API key in v2_settings.anthropic_api_key
//   2. Server env var ANTHROPIC_API_KEY (the dashboard's default — Cliff's account)
//   3. null → AI features degrade gracefully
//
// Callers should treat a null return as "AI is unavailable" and use their
// own non-AI fallback path.

import Anthropic from '@anthropic-ai/sdk'

const ENV_VAR = 'ANTHROPIC_API_KEY'
const SETTING_KEY = 'anthropic_api_key'

export async function getAnthropicApiKey(supabase) {
  try {
    if (supabase) {
      const { data } = await supabase
        .from('v2_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle()
      const userKey = typeof data?.value === 'string' ? data.value.trim() : ''
      if (userKey) return { key: userKey, source: 'user' }
    }
  } catch (err) {
    // Don't let a settings lookup fail break the AI flow — fall through to env.
    console.error('getAnthropicApiKey settings lookup failed:', err.message || err)
  }

  const envKey = process.env[ENV_VAR]
  if (envKey) return { key: envKey, source: 'env' }

  return { key: null, source: 'none' }
}

export async function getAnthropicClient(supabase) {
  const { key } = await getAnthropicApiKey(supabase)
  if (!key) return null
  return new Anthropic({ apiKey: key })
}
