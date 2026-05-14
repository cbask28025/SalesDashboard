'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Search, MoreHorizontal, X, Send, Plus, AlertCircle } from 'lucide-react'
import {
  fullName, relativeTime, STATUS_LABEL, STATUS_ORDER, TIER_LABEL,
} from '../../../lib/format'
import {
  pauseSequence, resumeSequence, resetPipeline, deleteLeads, updateLeadStatus,
  sendNowToLeads, listActiveTemplatesForSendNow, addLead,
} from './actions'
import LeadDrawer from './lead-drawer'

// Statuses where the lead is no longer in an active sequence flow.
// pause/resume should not appear for these.
const TERMINAL_STATUSES = new Set([
  'closed_won', 'closed_lost', 'not_interested', 'unsubscribed', 'bounced',
])

export function canPauseSequence(lead) {
  return !TERMINAL_STATUSES.has(lead.status) && lead.status !== 'on_hold'
}

export function canResumeSequence(lead) {
  return lead.status === 'on_hold'
}

const ENGAGEMENT_FILTERS = {
  any: () => true,
  opened: (l) => (l.opens_count || 0) > 0,
  clicked: (l) => (l.clicks_count || 0) > 0,
  replied: (l) => (l.replies_count || 0) > 0,
  none: (l) => !l.opens_count && !l.clicks_count && !l.replies_count,
}

export default function LeadsList({ initialLeads }) {
  const [leads, setLeads] = useState(initialLeads)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [engagementFilter, setEngagementFilter] = useState('any')
  const [showUnsubscribed, setShowUnsubscribed] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [openLeadId, setOpenLeadId] = useState(null)
  const [rowMenu, setRowMenu] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [sendNowFor, setSendNowFor] = useState(null) // either { type: 'bulk' } or { type: 'single', leadId }
  const [showAddLead, setShowAddLead] = useState(false)
  const [isPending, startTransition] = useTransition()

  const states = useMemo(() => {
    return Array.from(new Set(initialLeads.map((l) => l.state).filter(Boolean))).sort()
  }, [initialLeads])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (!showUnsubscribed && l.unsubscribed) return false
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (tierFilter !== 'all' && l.tier !== tierFilter) return false
      if (stateFilter !== 'all' && l.state !== stateFilter) return false
      if (!ENGAGEMENT_FILTERS[engagementFilter](l)) return false
      if (q) {
        const hay = `${fullName(l)} ${l.email || ''} ${l.district_name || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [leads, search, statusFilter, tierFilter, stateFilter, engagementFilter, showUnsubscribed])

  const allVisibleSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id))

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        filtered.forEach((l) => next.delete(l.id))
      } else {
        filtered.forEach((l) => next.add(l.id))
      }
      return next
    })
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function applyAction(actionFn, ids, options = {}) {
    if (ids.length === 0) return
    if (options.confirm && !confirm(options.confirm)) return
    startTransition(async () => {
      const res = await actionFn(ids)
      if (!res.ok) {
        setFeedback({ type: 'err', message: res.error || 'Action failed' })
        return
      }
      setFeedback({ type: 'ok', message: options.successMessage || `Updated ${res.count} leads` })
      setSelected(new Set())
      // Optimistic local update — server revalidate will refresh server-rendered state.
      // For client-only state, apply the patch optimistically.
      if (options.optimisticPatch) {
        setLeads((prev) => prev.map((l) => ids.includes(l.id) ? { ...l, ...options.optimisticPatch } : l))
      }
      if (options.removeLocally) {
        setLeads((prev) => prev.filter((l) => !ids.includes(l.id)))
      }
    })
  }

  const selectedIds = Array.from(selected)
  const openLead = leads.find((l) => l.id === openLeadId)

  function handleLeadAdded(lead) {
    setLeads((prev) => [lead, ...prev])
    setShowAddLead(false)
    setFeedback({ type: 'ok', message: `Added ${fullName(lead)}` })
  }

  function handleSendNowDone({ sent, errors, skipped }) {
    setSendNowFor(null)
    setSelected(new Set())
    const parts = [`Sent ${sent} email${sent === 1 ? '' : 's'}`]
    if (skipped?.length) parts.push(`${skipped.length} skipped (unsubscribed)`)
    if (errors?.length) parts.push(`${errors.length} failed`)
    setFeedback({ type: errors?.length ? 'err' : 'ok', message: parts.join(' · ') })
  }

  return (
    <div className="leads-shell">
      <div className="leads-toolbar">
        <button className="leads-add-btn" onClick={() => setShowAddLead(true)}>
          <Plus size={14} /> Add lead
        </button>
      </div>

      <div className="leads-filter-bar">
        <div className="leads-search">
          <Search size={14} />
          <input
            type="search"
            placeholder="Search name / email / district…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
          <option value="all">All tiers</option>
          <option value="tier1">{TIER_LABEL.tier1}</option>
          <option value="tier2">{TIER_LABEL.tier2}</option>
          <option value="tier3">{TIER_LABEL.tier3}</option>
        </select>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="all">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={engagementFilter} onChange={(e) => setEngagementFilter(e.target.value)}>
          <option value="any">Any engagement</option>
          <option value="opened">Opened</option>
          <option value="clicked">Clicked</option>
          <option value="replied">Replied</option>
          <option value="none">No engagement</option>
        </select>
        <label className="leads-toggle">
          <input
            type="checkbox"
            checked={showUnsubscribed}
            onChange={(e) => setShowUnsubscribed(e.target.checked)}
          />
          <span>Show unsubscribed</span>
        </label>
      </div>

      {feedback && (
        <div className={`leads-feedback is-${feedback.type}`}>
          {feedback.message}
          <button onClick={() => setFeedback(null)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="leads-bulk-bar">
          <span><strong>{selectedIds.length}</strong> selected</span>
          <button onClick={() => setSendNowFor({ type: 'bulk' })} disabled={isPending}>
            <Send size={13} /> Send now
          </button>
          <button onClick={() => applyAction(pauseSequence, selectedIds, {
            successMessage: `Paused ${selectedIds.length} leads`,
            optimisticPatch: { status: 'on_hold' },
          })} disabled={isPending}>Pause sequence</button>
          <button onClick={() => applyAction(resetPipeline, selectedIds, {
            confirm: `Reset pipeline for ${selectedIds.length} leads? They will re-enter Email 1 sending.`,
            successMessage: `Reset pipeline for ${selectedIds.length} leads`,
            optimisticPatch: { sequence_step: 0, status: 'sequencing' },
          })} disabled={isPending}>Reset pipeline</button>
          <select
            disabled={isPending}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              e.target.value = ''
              if (!v) return
              applyAction((ids) => updateLeadStatus(ids, v), selectedIds, {
                successMessage: `Set status to ${STATUS_LABEL[v]} for ${selectedIds.length} leads`,
                optimisticPatch: { status: v },
              })
            }}
          >
            <option value="">Change status…</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button
            className="leads-bulk-danger"
            onClick={() => applyAction(deleteLeads, selectedIds, {
              confirm: `Delete ${selectedIds.length} leads? This cannot be undone.`,
              successMessage: `Deleted ${selectedIds.length} leads`,
              removeLocally: true,
            })}
            disabled={isPending}
          >Delete</button>
          <button className="leads-bulk-ghost" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="leads-table-wrap">
        <table className="leads-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Select all" />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Title</th>
              <th>District</th>
              <th>State</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Step</th>
              <th>Opens</th>
              <th>Clicks</th>
              <th>Replies</th>
              <th>Last activity</th>
              <th style={{ width: 32 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={15} className="leads-empty">No leads match these filters.</td></tr>
            ) : filtered.map((lead) => (
              <tr
                key={lead.id}
                className={`leads-row${selected.has(lead.id) ? ' is-selected' : ''}`}
                onClick={(e) => {
                  if (e.target.closest('.leads-cell-stop')) return
                  setOpenLeadId(lead.id)
                }}
              >
                <td className="leads-cell-stop" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => toggleSelected(lead.id)}
                    aria-label={`Select ${fullName(lead)}`}
                  />
                </td>
                <td>
                  <div className="leads-name">
                    <strong>{fullName(lead)}</strong>
                    {lead.unsubscribed && <span className="leads-unsub-badge">unsubscribed</span>}
                  </div>
                </td>
                <td>{lead.email}</td>
                <td>{lead.phone || '—'}</td>
                <td>{lead.title || '—'}</td>
                <td>{lead.district_name || '—'}</td>
                <td>{lead.state || '—'}</td>
                <td>{lead.tier ? <span className={`tier-badge is-${lead.tier}`}>{TIER_LABEL[lead.tier]}</span> : '—'}</td>
                <td><span className={`status-badge is-${lead.status}`}>{STATUS_LABEL[lead.status] || lead.status}</span></td>
                <td>{lead.sequence_step ?? 0}</td>
                <td>{lead.opens_count ?? 0}</td>
                <td>{lead.clicks_count ?? 0}</td>
                <td>{lead.replies_count ?? 0}</td>
                <td>{relativeTime(lead.last_activity_at)}</td>
                <td className="leads-cell-stop" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="leads-row-menu"
                    onClick={() => setRowMenu(rowMenu === lead.id ? null : lead.id)}
                    aria-label="Row actions"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {rowMenu === lead.id && (
                    <div className="leads-row-menu-panel" onMouseLeave={() => setRowMenu(null)}>
                      <button onClick={() => { setRowMenu(null); setSendNowFor({ type: 'single', leadId: lead.id }) }}>
                        Send email now
                      </button>
                      {canPauseSequence(lead) && (
                        <button onClick={() => { setRowMenu(null); applyAction(pauseSequence, [lead.id], { successMessage: 'Sequence paused', optimisticPatch: { status: 'on_hold' } }) }}>
                          Pause sequence
                        </button>
                      )}
                      {canResumeSequence(lead) && (
                        <button onClick={() => { setRowMenu(null); applyAction(resumeSequence, [lead.id], { successMessage: 'Sequence resumed', optimisticPatch: { status: 'sequencing' } }) }}>
                          Resume sequence
                        </button>
                      )}
                      <button onClick={() => { setRowMenu(null); applyAction(resetPipeline, [lead.id], { confirm: 'Reset pipeline for this lead?', successMessage: 'Pipeline reset', optimisticPatch: { sequence_step: 0, status: 'sequencing' } }) }}>Reset pipeline</button>
                      <button onClick={() => { setRowMenu(null); applyAction((ids) => updateLeadStatus(ids, 'not_interested'), [lead.id], { successMessage: 'Marked not interested', optimisticPatch: { status: 'not_interested' } }) }}>Mark not interested</button>
                      <button onClick={() => { setRowMenu(null); applyAction((ids) => updateLeadStatus(ids, 'closed_won'), [lead.id], { successMessage: 'Marked closed won', optimisticPatch: { status: 'closed_won' } }) }}>Mark closed won</button>
                      <button onClick={() => { setRowMenu(null); setOpenLeadId(lead.id) }}>Open detail</button>
                      <button
                        className="leads-row-menu-danger"
                        onClick={() => { setRowMenu(null); applyAction(deleteLeads, [lead.id], { confirm: 'Delete this lead?', successMessage: 'Lead deleted', removeLocally: true }) }}
                      >Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="leads-footer">
        Showing {filtered.length} of {leads.length} leads
      </div>

      {openLead && (
        <LeadDrawer
          lead={openLead}
          onClose={() => setOpenLeadId(null)}
          onLeadUpdate={(patch) =>
            setLeads((prev) => prev.map((l) => l.id === openLead.id ? { ...l, ...patch } : l))
          }
          onLeadRemove={() => {
            setLeads((prev) => prev.filter((l) => l.id !== openLead.id))
            setOpenLeadId(null)
          }}
          onSendNow={() => setSendNowFor({ type: 'single', leadId: openLead.id })}
        />
      )}

      {sendNowFor && (
        <SendNowModal
          targetIds={sendNowFor.type === 'bulk' ? selectedIds : [sendNowFor.leadId]}
          targetLeads={
            sendNowFor.type === 'bulk'
              ? leads.filter((l) => selected.has(l.id))
              : leads.filter((l) => l.id === sendNowFor.leadId)
          }
          onClose={() => setSendNowFor(null)}
          onDone={handleSendNowDone}
        />
      )}

      {showAddLead && (
        <AddLeadModal onClose={() => setShowAddLead(false)} onAdded={handleLeadAdded} />
      )}
    </div>
  )
}

// ============================================================
// SendNowModal — picks a template and fires a one-off send to N leads
// ============================================================

function SendNowModal({ targetIds, targetLeads, onClose, onDone }) {
  const [templates, setTemplates] = useState([])
  const [templateId, setTemplateId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    listActiveTemplatesForSendNow().then((res) => {
      setLoading(false)
      if (!res.ok) {
        setError(res.error || 'Failed to load templates')
        return
      }
      setTemplates(res.templates)
      if (res.templates[0]) setTemplateId(res.templates[0].id)
    })
  }, [])

  const recipients = targetLeads.length
  const eligible = targetLeads.filter((l) => !l.unsubscribed).length
  const skipped = recipients - eligible

  function submit() {
    if (!templateId) return setError('Pick a template to send')
    setError(null)
    startTransition(async () => {
      const res = await sendNowToLeads(targetIds, templateId)
      if (!res.ok) return setError(res.error || 'Send failed')
      onDone({ sent: res.sent, errors: res.errors, skipped: res.skipped })
    })
  }

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal send-now-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Send now to {recipients} {recipients === 1 ? 'lead' : 'leads'}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </header>

        <div className="send-now-warning">
          <AlertCircle size={14} />
          <p>
            <strong>This is a one-off send.</strong> It will NOT advance the lead's position in the sequence — they'll
            still get whatever email is next on schedule. Use this for re-engaging or repeating a specific email outside
            the normal flow.
          </p>
        </div>

        {loading ? (
          <p className="drawer-loading">Loading templates…</p>
        ) : templates.length === 0 ? (
          <div className="leads-feedback is-err">
            No active templates available. Go to Pipeline tab and add one.
          </div>
        ) : (
          <label>
            Choose which email to send
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.subject_template.slice(0, 60)}{t.subject_template.length > 60 ? '…' : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        {skipped > 0 && (
          <p className="send-now-skipped">
            {skipped} lead{skipped === 1 ? ' is' : 's are'} unsubscribed and will be skipped.
          </p>
        )}

        {error && <div className="leads-feedback is-err">{error}</div>}

        <div className="task-modal-actions">
          <button
            className="upload-btn-primary"
            onClick={submit}
            disabled={isPending || loading || !templateId || eligible === 0}
          >
            {isPending ? 'Sending…' : `Send to ${eligible} now`}
          </button>
          <button className="upload-btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// AddLeadModal — single-lead manual entry
// ============================================================

function AddLeadModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    title: '', district_name: '', state: '', tier: 'tier3', status: 'sequencing',
  })
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await addLead(form)
      if (!res.ok) return setError(res.error || 'Failed to add lead')
      onAdded(res.lead)
    })
  }

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal add-lead-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Add a lead</h3>
          <button onClick={onClose}><X size={16} /></button>
        </header>

        <div className="add-lead-grid">
          <label>
            First name
            <input value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} autoFocus />
          </label>
          <label>
            Last name
            <input value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} />
          </label>
          <label className="is-full">
            Email <em>*</em>
            <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
          </label>
          <label>
            Title
            <input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="e.g. Director of Curriculum" />
          </label>
          <label className="is-full">
            District / school
            <input value={form.district_name} onChange={(e) => setField('district_name', e.target.value)} />
          </label>
          <label>
            State
            <input value={form.state} onChange={(e) => setField('state', e.target.value.toUpperCase())} maxLength={2} placeholder="TX" />
          </label>
          <label>
            Tier
            <select value={form.tier} onChange={(e) => setField('tier', e.target.value)}>
              <option value="tier1">{TIER_LABEL.tier1}</option>
              <option value="tier2">{TIER_LABEL.tier2}</option>
              <option value="tier3">{TIER_LABEL.tier3}</option>
            </select>
          </label>
          <label>
            Initial status
            <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="leads-feedback is-err">{error}</div>}

        <div className="task-modal-actions">
          <button className="upload-btn-primary" onClick={submit} disabled={isPending || !form.email.trim()}>
            {isPending ? 'Adding…' : 'Add lead'}
          </button>
          <button className="upload-btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
