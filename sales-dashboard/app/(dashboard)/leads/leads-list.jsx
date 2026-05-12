'use client'

import { useMemo, useState, useTransition } from 'react'
import { Search, MoreHorizontal, X } from 'lucide-react'
import {
  fullName, relativeTime, STATUS_LABEL, STATUS_ORDER, TIER_LABEL,
} from '../../../lib/format'
import {
  pauseSequence, resumeSequence, resetPipeline, deleteLeads, updateLeadStatus,
} from './actions'
import LeadDrawer from './lead-drawer'

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

  return (
    <div className="leads-shell">
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
                      <button onClick={() => { setRowMenu(null); applyAction(pauseSequence, [lead.id], { successMessage: 'Sequence paused', optimisticPatch: { status: 'on_hold' } }) }}>Pause sequence</button>
                      <button onClick={() => { setRowMenu(null); applyAction(resumeSequence, [lead.id], { successMessage: 'Sequence resumed', optimisticPatch: { status: 'sequencing' } }) }}>Resume sequence</button>
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
        />
      )}
    </div>
  )
}
