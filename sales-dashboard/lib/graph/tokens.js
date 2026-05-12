import { refreshAccessToken } from './oauth'

const TOKEN_KEY = 'outlook_tokens'
const EXPIRY_BUFFER_MS = 5 * 60 * 1000 // refresh 5 min before expiry

/**
 * Stored token shape (in v2_settings.value JSONB):
 *   { access_token, refresh_token, expires_at: ISO, account_email, account_id, scope }
 */

export async function storeTokens(supabase, partial) {
  const { data: existing } = await supabase
    .from('v2_settings')
    .select('value')
    .eq('key', TOKEN_KEY)
    .maybeSingle()

  const merged = { ...(existing?.value || {}), ...partial }
  await supabase
    .from('v2_settings')
    .upsert({ key: TOKEN_KEY, value: merged }, { onConflict: 'key' })
  return merged
}

export async function clearTokens(supabase) {
  await supabase
    .from('v2_settings')
    .upsert({ key: TOKEN_KEY, value: {} }, { onConflict: 'key' })
}

export async function getStoredTokens(supabase) {
  const { data } = await supabase
    .from('v2_settings')
    .select('value')
    .eq('key', TOKEN_KEY)
    .maybeSingle()
  if (!data?.value || !data.value.access_token) return null
  return data.value
}

export async function getValidAccessToken(supabase) {
  const tokens = await getStoredTokens(supabase)
  if (!tokens) return null

  const expiresAt = tokens.expires_at ? new Date(tokens.expires_at).getTime() : 0
  if (expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
    return tokens.access_token
  }

  if (!tokens.refresh_token) return null
  const refreshed = await refreshAccessToken(tokens.refresh_token)
  const expiresAtIso = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
  const updated = await storeTokens(supabase, {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || tokens.refresh_token,
    expires_at: expiresAtIso,
    scope: refreshed.scope,
  })
  return updated.access_token
}
