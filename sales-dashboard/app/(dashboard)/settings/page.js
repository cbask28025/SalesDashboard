import { createClient } from '../../../lib/supabase/server'
import { getStoredTokens } from '../../../lib/graph/tokens'
import SettingsForm from './settings-form'

export const metadata = { title: 'Settings — CTB Sales Dashboard' }

const DEFAULTS = {
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

function startOfMonthIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

async function loadAiUsage(supabase) {
  const { data: rows, error } = await supabase
    .from('v2_ai_usage')
    .select('estimated_cost_cents, feature, created_at')
  if (error || !rows || rows.length === 0) {
    return { thisMonthCents: 0, lifetimeCents: 0, monthCount: 0, avgMonthlyCents: 0, byFeatureThisMonth: {} }
  }

  const monthStart = startOfMonthIso()
  let lifetimeCents = 0
  let thisMonthCents = 0
  const byFeatureThisMonth = {}
  const monthKeys = new Set()

  for (const r of rows) {
    const c = Number(r.estimated_cost_cents) || 0
    lifetimeCents += c
    const created = r.created_at
    if (created >= monthStart) {
      thisMonthCents += c
      byFeatureThisMonth[r.feature] = (byFeatureThisMonth[r.feature] || 0) + c
    }
    if (created) {
      monthKeys.add(created.slice(0, 7)) // YYYY-MM
    }
  }

  const monthCount = Math.max(1, monthKeys.size)
  const avgMonthlyCents = lifetimeCents / monthCount

  return { thisMonthCents, lifetimeCents, monthCount, avgMonthlyCents, byFeatureThisMonth }
}

async function loadDocuments(supabase) {
  const { data } = await supabase
    .from('v2_ai_documents')
    .select('id, name, purpose, content, filename, file_size_bytes, is_active, updated_at')
    .order('updated_at', { ascending: false })
  return data || []
}

export default async function SettingsPage({ searchParams }) {
  const supabase = createClient()
  const [settings, tokens, aiUsage, documents] = await Promise.all([
    loadAll(supabase),
    getStoredTokens(supabase),
    loadAiUsage(supabase),
    loadDocuments(supabase),
  ])

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
        <p>Hot lead thresholds, sending rules, Outlook connection, AI assistant + reference docs, AI cost report, and notification preferences. Per-step delays live on each email in the Pipeline tab.</p>
      </div>
      <SettingsForm
        initialSettings={settings}
        outlook={outlook}
        aiUsage={aiUsage}
        documents={documents}
        oauthMessage={
          searchParams?.outlook_connected ? 'Outlook connected.' :
          searchParams?.outlook_error ? `Outlook error: ${searchParams.outlook_error}` :
          null
        }
      />
    </div>
  )
}
