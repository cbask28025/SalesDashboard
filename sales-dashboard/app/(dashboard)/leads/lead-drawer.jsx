'use client'

import { useEffect, useState, useTransition } from 'react'
import { X, Pin, PinOff, Trash2, Copy } from 'lucide-react'
import {
  fullName, relativeTime, absoluteTime,
  STATUS_LABEL, STATUS_ORDER, TIER_LABEL,
} from '../../../lib/format'
import {
  fetchLeadDetail, addNote, deleteNote, togglePinNote,
  pauseSequence, resumeSequence, resetPipeline, deleteLeads, updateLeadStatus,
} from './actions'

export default function LeadDrawer({ lead, onClose, onLeadUpdate, onLeadRemove }) {
  const [detail, setDetail] = useState(null)
  const [newNote, setNewNote] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    fetchLeadDetail(lead.id).then((d) => {
      if (active) setDetail(d)
    })
    return () => { active = false }
  }, [lead.id])

  function copy(value) {
    if (!value) return
    navigator.clipboard?.writeText(value)
  }

  function runLeadAction(actionFn, opts = {}) {
    if (opts.confirm && !confirm(opts.confirm)) return
    startTransition(async () => {
      const res = await actionFn([lead.id])
      if (!res.ok) return setError(res.error || 'Action failed')
      if (opts.optimisticPatch) onLeadUpdate(opts.optimisticPatch)
      if (opts.removeLocally) onLeadRemove()
    })
  }

  function submitNote() {
    if (!newNote.trim()) return
    startTransition(async () => {
      const res = await addNote(lead.id, newNote)
      if (!res.ok) return setError(res.error || 'Failed to add note')
      setDetail((d) => ({ ...d, notes: [res.note, ...(d?.notes || [])] }))
      setNewNote('')
    })
  }

  function removeNote(noteId) {
    if (!confirm('Delete this note?')) return
    startTransition(async () => {
      const res = await deleteNote(noteId)
      if (!res.ok) return setError(res.error || 'Failed to delete note')
      setDetail((d) => ({ ...d, notes: (d?.notes || []).filter((n) => n.id !== noteId) }))
    })
  }

  function togglePin(note) {
    startTransition(async () => {
      const res = await togglePinNote(note.id, !note.pinned)
      if (!res.ok) return setError(res.error || 'Failed to pin')
      setDetail((d) => ({
        ...d,
        notes: (d?.notes || []).map((n) => n.id === note.id ? { ...n, pinned: !note.pinned } : n),
      }))
    })
  }

  const pinnedNotes = (detail?.notes || []).filter((n) => n.pinned)
  const unpinnedNotes = (detail?.notes || []).filter((n) => !n.pinned)

  const timeline = buildTimeline(lead, detail)

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer-panel" role="dialog" aria-label={`Lead detail: ${fullName(lead)}`}>
        <header className="drawer-header">
          <div className="drawer-header-main">
            <h3>{fullName(lead)}</h3>
            <div className="drawer-header-meta">
              {lead.title && <span>{lead.title}</span>}
              {lead.district_name && <span> · {lead.district_name}</span>}
              {lead.state && <span> · {lead.state}</span>}
            </div>
            <div className="drawer-header-badges">
              {lead.tier && <span className={`tier-badge is-${lead.tier}`}>{TIER_LABEL[lead.tier]}</span>}
              <span className={`status-badge is-${lead.status}`}>{STATUS_LABEL[lead.status] || lead.status}</span>
              {lead.unsubscribed && <span className="leads-unsub-badge">unsubscribed</span>}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="drawer-actions-row">
          <button onClick={() => runLeadAction(pauseSequence, { optimisticPatch: { status: 'on_hold' } })} disabled={isPending}>Pause</button>
          <button onClick={() => runLeadAction(resumeSequence, { optimisticPatch: { status: 'sequencing' } })} disabled={isPending}>Resume</button>
          <button onClick={() => runLeadAction(resetPipeline, { confirm: 'Reset pipeline?', optimisticPatch: { sequence_step: 0, status: 'sequencing' } })} disabled={isPending}>Reset</button>
          <select
            disabled={isPending}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              e.target.value = ''
              if (!v) return
              runLeadAction((ids) => updateLeadStatus(ids, v), { optimisticPatch: { status: v } })
            }}
          >
            <option value="">Change status…</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button
            className="drawer-danger"
            onClick={() => runLeadAction(deleteLeads, { confirm: 'Delete this lead permanently?', removeLocally: true })}
            disabled={isPending}
          >Delete</button>
        </div>

        {error && <div className="drawer-error">{error}</div>}

        <section className="drawer-section">
          <h4>Contact</h4>
          <div className="drawer-contact">
            <button className="drawer-copy" onClick={() => copy(lead.email)} title="Copy email">
              <Copy size={12} /> {lead.email}
            </button>
            {lead.phone && (
              <button className="drawer-copy" onClick={() => copy(lead.phone)} title="Copy phone">
                <Copy size={12} /> {lead.phone}
              </button>
            )}
          </div>
        </section>

        <section className="drawer-section">
          <h4>Engagement</h4>
          <div className="drawer-engagement">
            <div><strong>{lead.opens_count || 0}</strong><span>opens</span></div>
            <div><strong>{lead.clicks_count || 0}</strong><span>clicks</span></div>
            <div><strong>{lead.replies_count || 0}</strong><span>replies</span></div>
            <div><strong>{lead.sequence_step || 0}/3</strong><span>step</span></div>
          </div>
        </section>

        <section className="drawer-section">
          <h4>Notes</h4>
          <div className="drawer-note-form">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this lead…"
              rows={3}
            />
            <button onClick={submitNote} disabled={!newNote.trim() || isPending}>
              {isPending ? 'Saving…' : 'Add note'}
            </button>
          </div>
          <div className="drawer-notes-list">
            {!detail && <p className="drawer-loading">Loading…</p>}
            {detail && pinnedNotes.length === 0 && unpinnedNotes.length === 0 && (
              <p className="drawer-empty">No notes yet.</p>
            )}
            {[...pinnedNotes, ...unpinnedNotes].map((note) => (
              <div key={note.id} className={`drawer-note${note.pinned ? ' is-pinned' : ''}`}>
                <div className="drawer-note-body">{note.body}</div>
                <div className="drawer-note-footer">
                  <span>{relativeTime(note.created_at)} · {note.source === 'ai_from_reply' ? 'AI' : 'You'}</span>
                  <div className="drawer-note-actions">
                    <button onClick={() => togglePin(note)} title={note.pinned ? 'Unpin' : 'Pin'}>
                      {note.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                    <button onClick={() => removeNote(note.id)} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="drawer-section">
          <h4>Timeline</h4>
          {!detail && <p className="drawer-loading">Loading…</p>}
          {detail && timeline.length === 0 && <p className="drawer-empty">No activity yet.</p>}
          {detail && (
            <ol className="drawer-timeline">
              {timeline.map((evt, i) => (
                <li key={i}>
                  <div className="drawer-timeline-dot" aria-hidden="true" />
                  <div className="drawer-timeline-content">
                    <strong>{evt.title}</strong>
                    {evt.body && <p>{evt.body}</p>}
                    <time>{absoluteTime(evt.at)}</time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </>
  )
}

function buildTimeline(lead, detail) {
  if (!detail) return []
  const items = []
  items.push({ at: lead.created_at, title: 'Imported', body: lead.source ? `from ${lead.source}` : null })
  for (const s of detail.sends) {
    items.push({ at: s.sent_at, title: `${labelTemplate(s.email_template)} sent` })
  }
  for (const e of detail.events) {
    items.push({ at: e.occurred_at, title: eventTitle(e), body: e.event_type === 'click' ? e.metadata?.link : null })
  }
  for (const r of detail.replies) {
    items.push({
      at: r.received_at,
      title: `Reply received${r.classification ? ` (${r.classification})` : ''}`,
      body: r.body?.slice(0, 200) + (r.body && r.body.length > 200 ? '…' : ''),
    })
  }
  for (const n of detail.notes) {
    items.push({ at: n.created_at, title: 'Note added', body: n.body.slice(0, 200) })
  }
  return items.sort((a, b) => new Date(b.at) - new Date(a.at))
}

function labelTemplate(t) {
  if (t === 'email_1') return 'Email 1'
  if (t === 'email_2') return 'Email 2'
  if (t === 'email_3') return 'Email 3'
  return t || 'Email'
}

function eventTitle(e) {
  switch (e.event_type) {
    case 'open': return 'Email opened'
    case 'click': return 'Link clicked'
    case 'reply': return 'Reply received'
    case 'bounce': return 'Bounced'
    case 'unsubscribe': return 'Unsubscribed'
    default: return e.event_type
  }
}
