import { createClient } from '../../../lib/supabase/server'
import { getStoredTokens } from '../../../lib/graph/tokens'
import SettingsForm from './settings-form'

export const metadata = { title: 'Settings — CTB Sales Dashboard' }

const DEFAULTS = {
  sequence_timing: { email_1_to_2_days: 3, email_2_to_3_days: 5 },
  hot_lead_thresholds: { min_opens: 1, min_clicks: 1 },
  sending_rules: {
    daily_limit: 50,
    start_hour: 9,
    end_hour: 14,
    weekdays_only: true,
    skip_holidays: true,
    timezone: 'America/New_York',
  },
  notification_prefs: { clicks: true, replies: true, hot_leads: true, sound: false, browser_push: false },
  assistant_system_prompt: 'You are a professional, concise sales assistant for Choosing the Best (CTB).',
}

async function loadAll(supabase) {
  const keys = Object.keys(DEFAULTS)
  const { data } = await supabase.from('v2_settings').select('key, value').in('key', keys)
  const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]))
  const out = {}
  for (const k of keys) out[k] = map[k] ?? DEFAULTS[k]
  return out
}

export default async function SettingsPage({ searchParams }) {
  const supabase = createClient()
  const [settings, tokens] = await Promise.all([loadAll(supabase), getStoredTokens(supabase)])

  const outlook = tokens?.access_token
    ? {
        connected: true,
        accountEmail: tokens.account_email,
        connectedAt: tokens.connected_at,
        expiresAt: tokens.expires_at,
      }
    : { connected: false }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <h2>Settings</h2>
        <p>Sequence timing, sending rules, Outlook connection, AI assistant, and notification preferences.</p>
      </div>
      <SettingsForm
        initialSettings={settings}
        outlook={outlook}
        oauthMessage={
          searchParams?.outlook_connected ? 'Outlook connected.' :
          searchParams?.outlook_error ? `Outlook error: ${searchParams.outlook_error}` :
          null
        }
      />
    </div>
  )
}
