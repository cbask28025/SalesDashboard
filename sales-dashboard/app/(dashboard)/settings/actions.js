'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'
import { getStoredTokens } from '../../../lib/graph/tokens'
import { sendMail } from '../../../lib/graph/client'

const ALLOWED_KEYS = new Set([
  'hot_lead_thresholds', 'sending_rules',
  'notification_prefs', 'assistant_system_prompt',
])

export async function saveSettings(updates) {
  const supabase = createClient()
  const rows = []
  for (const [key, value] of Object.entries(updates || {})) {
    if (!ALLOWED_KEYS.has(key)) continue
    rows.push({ key, value, updated_at: new Date().toISOString() })
  }
  if (rows.length === 0) return { ok: false, error: 'No valid settings to save' }
  const { error } = await supabase.from('v2_settings').upsert(rows, { onConflict: 'key' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings')
  return { ok: true, count: rows.length }
}

export async function sendTestEmail() {
  const supabase = createClient()
  const tokens = await getStoredTokens(supabase)
  if (!tokens?.account_email) return { ok: false, error: 'Outlook is not connected' }

  try {
    await sendMail(supabase, {
      to: tokens.account_email,
      subject: 'CTB Sales Dashboard — Test send',
      htmlBody: '<p>This is a test email sent from the CTB Sales Dashboard. Your Outlook connection is working.</p>',
    })
    return { ok: true, sentTo: tokens.account_email }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
