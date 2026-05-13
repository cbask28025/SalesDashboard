'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { CheckCircle2, AlertCircle, RefreshCw, LogOut, Send } from 'lucide-react'
import { saveSettings, sendTestEmail } from './actions'
import { format } from 'date-fns'

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
]

export default function SettingsForm({ initialSettings, outlook, oauthMessage }) {
  const [draft, setDraft] = useState(initialSettings)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState(oauthMessage ? { type: 'info', message: oauthMessage } : null)
  const [testResult, setTestResult] = useState(null)

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initialSettings), [draft, initialSettings])

  function patch(key, value) {
    setDraft((d) => ({ ...d, [key]: typeof value === 'function' ? value(d[key]) : value }))
  }

  function save() {
    startTransition(async () => {
      const res = await saveSettings(draft)
      if (!res.ok) return setFeedback({ type: 'err', message: res.error })
      setFeedback({ type: 'ok', message: 'Saved' })
    })
  }

  function discard() {
    setDraft(initialSettings)
    setFeedback(null)
  }

  function testSend() {
    setTestResult(null)
    startTransition(async () => {
      const res = await sendTestEmail()
      setTestResult(res.ok ? { ok: true, message: `Sent test to ${res.sentTo}` } : { ok: false, message: res.error })
    })
  }

  async function disconnect() {
    if (!confirm('Disconnect Outlook? Sending will stop until you reconnect.')) return
    await fetch('/api/auth/outlook/disconnect', { method: 'POST' })
    window.location.reload()
  }

  // Approx token counter for the system prompt — 1 token ≈ 4 chars.
  const promptTokens = Math.ceil((draft.assistant_system_prompt || '').length / 4)

  return (
    <div className="settings-shell">
      {feedback && (
        <div className={`leads-feedback is-${feedback.type === 'info' ? 'ok' : feedback.type}`}>
          {feedback.message}
        </div>
      )}

      <Section
        title="1 · Hot lead thresholds"
        help="A reply always promotes a lead to hot, regardless of these thresholds. Per-step delays now live on each email in the Pipeline tab."
      >
        <NumberField
          label="Minimum opens"
          value={draft.hot_lead_thresholds.min_opens}
          onChange={(v) => patch('hot_lead_thresholds', { ...draft.hot_lead_thresholds, min_opens: v })}
        />
        <NumberField
          label="Minimum clicks"
          value={draft.hot_lead_thresholds.min_clicks}
          onChange={(v) => patch('hot_lead_thresholds', { ...draft.hot_lead_thresholds, min_clicks: v })}
        />
      </Section>

      <Section title="2 · Sending rules">
        <NumberField
          label="Daily send limit"
          value={draft.sending_rules.daily_limit}
          onChange={(v) => patch('sending_rules', { ...draft.sending_rules, daily_limit: v })}
        />
        <NumberField
          label="Start hour (24h)"
          value={draft.sending_rules.start_hour}
          min={0}
          max={23}
          onChange={(v) => patch('sending_rules', { ...draft.sending_rules, start_hour: v })}
        />
        <NumberField
          label="End hour (24h)"
          value={draft.sending_rules.end_hour}
          min={0}
          max={24}
          onChange={(v) => patch('sending_rules', { ...draft.sending_rules, end_hour: v })}
        />
        <CheckField
          label="Weekdays only"
          checked={draft.sending_rules.weekdays_only}
          onChange={(v) => patch('sending_rules', { ...draft.sending_rules, weekdays_only: v })}
        />
        <CheckField
          label="Skip US federal holidays"
          checked={draft.sending_rules.skip_holidays}
          onChange={(v) => patch('sending_rules', { ...draft.sending_rules, skip_holidays: v })}
        />
        <label className="settings-field">
          <span>Timezone</span>
          <select
            value={draft.sending_rules.timezone}
            onChange={(e) => patch('sending_rules', { ...draft.sending_rules, timezone: e.target.value })}
          >
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </label>
      </Section>

      <Section title="3 · Outlook connection">
        {outlook.connected ? (
          <div className="settings-outlook-connected">
            <CheckCircle2 size={20} />
            <div>
              <strong>Connected as {outlook.accountEmail}</strong>
              {outlook.connectedAt && <p>Connected {format(new Date(outlook.connectedAt), 'MMM d, yyyy')}</p>}
            </div>
            <div className="settings-outlook-actions">
              <a href="/api/auth/outlook/start" className="settings-link-btn"><RefreshCw size={13} /> Reconnect</a>
              <button onClick={disconnect} className="settings-danger"><LogOut size={13} /> Disconnect</button>
              <button onClick={testSend} disabled={isPending}><Send size={13} /> Send test email</button>
            </div>
            {testResult && (
              <div className={`leads-feedback is-${testResult.ok ? 'ok' : 'err'}`}>{testResult.message}</div>
            )}
          </div>
        ) : (
          <div className="settings-outlook-disconnected">
            <AlertCircle size={20} />
            <span>Outlook not connected. Connect to enable sending and reply polling.</span>
            <a href="/api/auth/outlook/start" className="settings-link-btn">Connect Outlook</a>
          </div>
        )}
      </Section>

      <Section title="4 · AI assistant" help={`System prompt that drives the chat bubble. ~${promptTokens} tokens.`}>
        <label className="settings-field is-full">
          <span>System prompt</span>
          <textarea
            rows={6}
            value={draft.assistant_system_prompt || ''}
            onChange={(e) => patch('assistant_system_prompt', e.target.value)}
          />
        </label>
      </Section>

      <Section title="5 · Notification preferences">
        <CheckField
          label="New link clicks"
          checked={draft.notification_prefs.clicks}
          onChange={(v) => patch('notification_prefs', { ...draft.notification_prefs, clicks: v })}
        />
        <CheckField
          label="New replies"
          checked={draft.notification_prefs.replies}
          onChange={(v) => patch('notification_prefs', { ...draft.notification_prefs, replies: v })}
        />
        <CheckField
          label="New hot leads"
          checked={draft.notification_prefs.hot_leads}
          onChange={(v) => patch('notification_prefs', { ...draft.notification_prefs, hot_leads: v })}
        />
        <CheckField
          label="Sound on notification"
          checked={draft.notification_prefs.sound}
          onChange={(v) => patch('notification_prefs', { ...draft.notification_prefs, sound: v })}
        />
        <CheckField
          label="Browser push (requires permission)"
          checked={draft.notification_prefs.browser_push}
          onChange={(v) => patch('notification_prefs', { ...draft.notification_prefs, browser_push: v })}
        />
      </Section>

      {dirty && (
        <div className="settings-save-bar">
          <span>You have unsaved changes.</span>
          <button onClick={discard} disabled={isPending} className="upload-btn-secondary">Discard</button>
          <button onClick={save} disabled={isPending} className="upload-btn-primary">
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}

function Section({ title, help, children }) {
  return (
    <section className="settings-section">
      <header>
        <h3>{title}</h3>
        {help && <p>{help}</p>}
      </header>
      <div className="settings-fields">{children}</div>
    </section>
  )
}

function NumberField({ label, value, onChange, min = 0, max = 999 }) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(e) => onChange(parseInt(e.target.value || '0', 10))}
      />
    </label>
  )
}

function CheckField({ label, checked, onChange }) {
  return (
    <label className="settings-field is-check">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
