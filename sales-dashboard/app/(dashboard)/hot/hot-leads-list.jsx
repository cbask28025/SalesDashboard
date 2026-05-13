'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { Mail, Phone, MessageSquare, Search } from 'lucide-react'
import { fullName, relativeTime, TIER_LABEL } from '../../../lib/format'
import { updateLeadStatus } from '../leads/actions'

const SORTS = {
  recent: (a, b) => new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0),
  tier: (a, b) => (a.tier || 'z').localeCompare(b.tier || 'z'),
}

export default function HotLeadsList({ leads, latestReplyByLead, pinnedNoteByLead }) {
  const [sortBy, setSortBy] = useState('recent')
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState(null)

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? leads.filter((l) => {
          const hay = `${fullName(l)} ${l.email || ''} ${l.district_name || ''} ${l.title || ''}`.toLowerCase()
          return hay.includes(q)
        })
      : leads
    return [...filtered].sort(SORTS[sortBy])
  }, [leads, search, sortBy])

  function copyPhone(phone) {
    if (!phone) return
    navigator.clipboard?.writeText(phone)
    setFeedback({ type: 'ok', message: `Copied ${phone}` })
  }

  function setStatus(leadId, newStatus, message) {
    startTransition(async () => {
      const res = await updateLeadStatus([leadId], newStatus)
      setFeedback(res.ok
        ? { type: 'ok', message: message || 'Updated' }
        : { type: 'err', message: res.error || 'Failed' })
    })
  }

  if (leads.length === 0) {
    return <div className="replies-empty">No hot leads yet. They appear here when leads engage or reply.</div>
  }

  return (
    <div className="hot-shell">
      <div className="hot-controls">
        <div className="hot-search">
          <Search size={14} />
          <input
            type="search"
            placeholder="Search by name, email, district…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label>
          Sort:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Most recent activity</option>
            <option value="tier">Tier (1 first)</option>
          </select>
        </label>
        <span className="hot-count">{sorted.length} of {leads.length}</span>
      </div>

      {feedback && <div className={`leads-feedback is-${feedback.type}`}>{feedback.message}</div>}

      {sorted.length === 0 && search && (
        <div className="replies-empty">No hot leads match "{search}".</div>
      )}

      <div className="hot-grid">
        {sorted.map((lead) => {
          const reply = latestReplyByLead[lead.id]
          const note = pinnedNoteByLead[lead.id]
          return (
            <article key={lead.id} className="hot-card">
              <header className="hot-card-header">
                <div>
                  <strong>{fullName(lead)}</strong>
                  <p>{lead.title}{lead.district_name ? ` · ${lead.district_name}` : ''}{lead.state ? `, ${lead.state}` : ''}</p>
                </div>
                <div className="hot-card-badges">
                  <span className="status-badge is-hot">Hot</span>
                  {lead.tier && <span className={`tier-badge is-${lead.tier}`}>{TIER_LABEL[lead.tier]}</span>}
                </div>
              </header>

              <div className="hot-contact">
                <button onClick={() => navigator.clipboard?.writeText(lead.email)}>
                  <Mail size={13} /> {lead.email}
                </button>
                {lead.phone && (
                  <button onClick={() => copyPhone(lead.phone)}>
                    <Phone size={13} /> {lead.phone}
                  </button>
                )}
              </div>

              <div className="hot-stats">
                <span><strong>{lead.opens_count || 0}</strong> opens</span>
                <span><strong>{lead.clicks_count || 0}</strong> clicks</span>
                <span><strong>{lead.replies_count || 0}</strong> replies</span>
                <span>Last: {relativeTime(lead.last_activity_at)}</span>
              </div>

              {reply && (
                <div className="hot-reply-preview">
                  <h5><MessageSquare size={12} /> Reply</h5>
                  <p>{reply.body.slice(0, 240)}{reply.body.length > 240 ? '…' : ''}</p>
                </div>
              )}

              {note && (
                <div className="hot-pinned-note">
                  <strong>Pinned note:</strong> {note.body.slice(0, 140)}{note.body.length > 140 ? '…' : ''}
                </div>
              )}

              <footer className="hot-card-actions">
                <Link href="/replies?tab=pending" className="hot-btn">View thread</Link>
                <button
                  className="hot-btn"
                  onClick={() => setStatus(lead.id, 'demo_scheduled', 'Marked demo scheduled')}
                  disabled={isPending}
                >Demo scheduled</button>
                <button
                  className="hot-btn hot-btn-ghost"
                  onClick={() => setStatus(lead.id, 'not_interested', 'Marked not interested')}
                  disabled={isPending}
                >Not interested</button>
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}
