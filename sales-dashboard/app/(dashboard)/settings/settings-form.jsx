'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import {
  CheckCircle2, AlertCircle, RefreshCw, LogOut, Send,
  Plus, Trash2, FileText, X, Upload,
} from 'lucide-react'
import {
  saveSettings, sendTestEmail,
  addReferenceDocument, updateReferenceDocument, deleteReferenceDocument,
} from './actions'
import { format } from 'date-fns'

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
]

const FEATURE_LABEL = {
  title_classify: 'Title classification',
  reply_classify: 'Reply classification',
  reply_draft: 'Reply drafting',
  task_suggest: 'Task suggestions',
  chat: 'Chat assistant',
  chat_followup: 'Chat tool follow-ups',
}

function formatUSD(cents) {
  const dollars = (cents || 0) / 100
  if (dollars === 0) return '$0.00'
  if (dollars < 0.01) return '< $0.01'
  return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export default function SettingsForm({ initialSettings, outlook, aiUsage, documents: initialDocs, oauthMessage }) {
  const [draft, setDraft] = useState(initialSettings)
  const [docs, setDocs] = useState(initialDocs || [])
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [editingDoc, setEditingDoc] = useState(null)
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

  function handleDocSaved(doc, isNew) {
    if (isNew) {
      setDocs((prev) => [doc, ...prev])
    } else {
      setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, ...doc } : d))
    }
    setShowNewDoc(false)
    setEditingDoc(null)
    setFeedback({ type: 'ok', message: isNew ? `Added "${doc.name}"` : `Saved "${doc.name}"` })
  }

  function removeDoc(doc) {
    if (!confirm(`Delete "${doc.name}"? The AI will no longer reference it.`)) return
    startTransition(async () => {
      const res = await deleteReferenceDocument(doc.id)
      if (!res.ok) return setFeedback({ type: 'err', message: res.error })
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      setFeedback({ type: 'ok', message: `Deleted "${doc.name}"` })
    })
  }

  function toggleDocActive(doc) {
    startTransition(async () => {
      const res = await updateReferenceDocument(doc.id, { is_active: !doc.is_active })
      if (!res.ok) return setFeedback({ type: 'err', message: res.error })
      setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, is_active: !doc.is_active } : d))
    })
  }

  const promptTokens = Math.ceil((draft.assistant_system_prompt || '').length / 4)

  return (
    <div className="settings-shell">
      {feedback && (
        <div className={`leads-feedback is-${feedback.type === 'info' ? 'ok' : feedback.type}`}>
          {feedback.message}
          <button onClick={() => setFeedback(null)} aria-label="Dismiss"><X size={13} /></button>
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

      <Section
        title="5 · AI reference documents"
        help="Documents the AI will draw from when drafting reply responses. Add case studies, pricing sheets, FAQs — anything the AI should cite from. Name + purpose tell Claude when to use it."
      >
        <div className="ai-docs-list settings-field is-full">
          {docs.length === 0 ? (
            <div className="ai-docs-empty">
              No documents yet. AI replies use only the system prompt + lead context.
            </div>
          ) : (
            docs.map((doc) => (
              <div key={doc.id} className={`ai-doc-row${doc.is_active ? '' : ' is-inactive'}`}>
                <FileText size={16} />
                <div className="ai-doc-info">
                  <strong>{doc.name}</strong>
                  <p>{doc.purpose}</p>
                  <span>{(doc.file_size_bytes || 0).toLocaleString()} chars · updated {format(new Date(doc.updated_at), 'MMM d')}</span>
                </div>
                <div className="ai-doc-actions">
                  <label className="ai-doc-toggle" title={doc.is_active ? 'Active — AI will use this' : 'Inactive'}>
                    <input
                      type="checkbox"
                      checked={doc.is_active}
                      onChange={() => toggleDocActive(doc)}
                    />
                    <span>{doc.is_active ? 'Active' : 'Off'}</span>
                  </label>
                  <button type="button" onClick={() => setEditingDoc(doc)} disabled={isPending}>Edit</button>
                  <button type="button" className="ai-doc-delete" onClick={() => removeDoc(doc)} disabled={isPending}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
          <button
            type="button"
            className="ai-docs-add"
            onClick={() => setShowNewDoc(true)}
          >
            <Plus size={14} /> Add reference document
          </button>
        </div>
      </Section>

      <Section
        title="6 · AI cost report"
        help="Estimated cost based on token usage. Updated every time the AI runs."
      >
        <div className="ai-cost-grid settings-field is-full">
          <div className="ai-cost-stat">
            <span>This month</span>
            <strong>{formatUSD(aiUsage.thisMonthCents)}</strong>
          </div>
          <div className="ai-cost-stat">
            <span>Average per month</span>
            <strong>{formatUSD(aiUsage.avgMonthlyCents)}</strong>
            <em>{aiUsage.monthCount} {aiUsage.monthCount === 1 ? 'month' : 'months'} of data</em>
          </div>
          <div className="ai-cost-stat">
            <span>Lifetime</span>
            <strong>{formatUSD(aiUsage.lifetimeCents)}</strong>
          </div>
        </div>
        {Object.keys(aiUsage.byFeatureThisMonth || {}).length > 0 && (
          <div className="ai-cost-breakdown settings-field is-full">
            <h5>Breakdown this month</h5>
            <table>
              <tbody>
                {Object.entries(aiUsage.byFeatureThisMonth)
                  .sort((a, b) => b[1] - a[1])
                  .map(([feature, cents]) => (
                    <tr key={feature}>
                      <td>{FEATURE_LABEL[feature] || feature}</td>
                      <td>{formatUSD(cents)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="7 · Notification preferences">
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

      {(showNewDoc || editingDoc) && (
        <DocumentModal
          existing={editingDoc}
          onClose={() => { setShowNewDoc(false); setEditingDoc(null) }}
          onSaved={handleDocSaved}
        />
      )}
    </div>
  )
}

function DocumentModal({ existing, onClose, onSaved }) {
  const [name, setName] = useState(existing?.name || '')
  const [purpose, setPurpose] = useState(existing?.purpose || '')
  const [content, setContent] = useState(existing?.content || '')
  const [filename, setFilename] = useState(existing?.filename || '')
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef(null)

  async function readFile(file) {
    if (!file) return
    if (file.size > 100_000) {
      setError(`File too large (${(file.size / 1024).toFixed(0)} KB). Max 100KB.`)
      return
    }
    const accept = /\.(txt|md|markdown)$/i
    if (!accept.test(file.name)) {
      setError('Only .txt and .md files supported here. Paste content from a PDF/DOC manually.')
      return
    }
    setError(null)
    const text = await file.text()
    setContent(text)
    setFilename(file.name)
    if (!name.trim()) {
      setName(file.name.replace(/\.[^.]+$/, ''))
    }
  }

  function submit() {
    setError(null)
    const payload = {
      name: name.trim(),
      purpose: purpose.trim(),
      content: content.trim(),
      filename: filename || null,
      fileSizeBytes: content.length,
    }
    startTransition(async () => {
      const res = existing
        ? await updateReferenceDocument(existing.id, payload)
        : await addReferenceDocument(payload)
      if (!res.ok) return setError(res.error || 'Save failed')
      onSaved(res.document || { ...existing, ...payload }, !existing)
    })
  }

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal ai-doc-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{existing ? 'Edit document' : 'Add reference document'}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </header>

        <label>
          Name (short)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 2022 Outcomes Study"
            autoFocus
          />
        </label>

        <label>
          Purpose (when should the AI use this?)
          <textarea
            rows={2}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Use when a prospect asks for evidence of curriculum effectiveness or research outcomes."
          />
        </label>

        <label>
          Content
          <div className="ai-doc-content-toolbar">
            <button
              type="button"
              className="upload-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} /> Upload .txt / .md
            </button>
            <span>or paste below ({content.length.toLocaleString()} chars)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              style={{ display: 'none' }}
              onChange={(e) => readFile(e.target.files[0])}
            />
          </div>
          <textarea
            rows={14}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste the document text here. For PDFs or DOCs, copy the relevant sections."
          />
        </label>

        {error && <div className="leads-feedback is-err">{error}</div>}

        <div className="task-modal-actions">
          <button className="upload-btn-primary" onClick={submit} disabled={isPending}>
            {isPending ? 'Saving…' : (existing ? 'Save changes' : 'Add document')}
          </button>
          <button className="upload-btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
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
