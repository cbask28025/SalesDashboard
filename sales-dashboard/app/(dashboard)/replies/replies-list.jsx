'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Send, RefreshCw, X } from 'lucide-react'
import { fullName, relativeTime, STATUS_LABEL, TIER_LABEL } from '../../../lib/format'
import { sendReplyAction, updateDraft, dismissReply, regenerateDraft } from './actions'

const CLASSIFICATION_LABELS = {
  positive: 'Positive',
  negative: 'Negative',
  question: 'Question',
  unsubscribe: 'Unsubscribe',
}

export default function RepliesList({ replies: initial, activeTab, counts }) {
  const router = useRouter()
  const [replies, setReplies] = useState(initial)
  const [drafts, setDrafts] = useState(() => Object.fromEntries(initial.map((r) => [r.id, r.ai_draft || ''])))
  const [feedback, setFeedback] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function refreshNow() {
    setRefreshing(true)
    setFeedback({ type: 'ok', message: 'Polling inbox…' })
    try {
      const res = await fetch('/api/cron/poll-replies', { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (!json.ok) {
        setFeedback({ type: 'err', message: json.error || 'Refresh failed' })
        setRefreshing(false)
        return
      }
      const summary = [
        `Scanned ${json.scanned ?? 0} message${json.scanned === 1 ? '' : 's'}`,
        `${json.matched ?? 0} matched to leads`,
        `${json.processed ?? 0} new repl${json.processed === 1 ? 'y' : 'ies'}`,
      ].join(' · ')
      setFeedback({ type: 'ok', message: summary })
      router.refresh()
    } catch (err) {
      setFeedback({ type: 'err', message: err.message || 'Refresh failed' })
    } finally {
      setRefreshing(false)
    }
  }

  // Auto-refresh whenever the tab regains focus — same trick the notification
  // bell uses. Cheap (one extra request per tab activation) and keeps replies
  // fresh without polling on a timer.
  useEffect(() => {
    function onFocus() {
      router.refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [router])

  function updateLocal(replyId, patch) {
    setReplies((prev) => prev.map((r) => r.id === replyId ? { ...r, ...patch } : r))
  }

  function setDraftFor(id, value) {
    setDrafts((d) => ({ ...d, [id]: value }))
  }

  function saveDraft(id) {
    startTransition(async () => {
      await updateDraft(id, drafts[id] || '')
    })
  }

  function send(id) {
    startTransition(async () => {
      const res = await sendReplyAction(id)
      if (!res.ok) return setFeedback({ type: 'err', message: res.error })
      setFeedback({ type: 'ok', message: 'Reply sent' })
      setReplies((prev) => prev.filter((r) => r.id !== id))
    })
  }

  function dismiss(id) {
    if (!confirm('Skip this reply for now?')) return
    startTransition(async () => {
      const res = await dismissReply(id)
      if (!res.ok) return setFeedback({ type: 'err', message: res.error })
      setReplies((prev) => prev.filter((r) => r.id !== id))
    })
  }

  function regen(id) {
    startTransition(async () => {
      const res = await regenerateDraft(id)
      if (!res.ok) return setFeedback({ type: 'err', message: res.error })
      setDraftFor(id, res.draft)
      updateLocal(id, { ai_draft: res.draft })
    })
  }

  return (
    <div className="replies-shell">
      <div className="replies-tabs">
        <Link className={`replies-tab${activeTab === 'pending' ? ' is-active' : ''}`} href="/replies?tab=pending">
          Pending <span>{counts.pending || 0}</span>
        </Link>
        <Link className={`replies-tab${activeTab === 'responded' ? ' is-active' : ''}`} href="/replies?tab=responded">
          Responded <span>{counts.responded || 0}</span>
        </Link>
        <button
          type="button"
          className="replies-refresh"
          onClick={refreshNow}
          disabled={refreshing}
          title="Poll inbox for new replies right now"
        >
          <RefreshCw size={13} className={refreshing ? 'is-spinning' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {feedback && (
        <div className={`leads-feedback is-${feedback.type}`}>
          {feedback.message}
          <button onClick={() => setFeedback(null)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {replies.length === 0 ? (
        <div className="replies-empty">
          {activeTab === 'pending' ? 'No replies awaiting response.' : 'No replies handled yet.'}
        </div>
      ) : (
        <div className="replies-cards">
          {replies.map((reply) => {
            const lead = reply.v2_leads
            const draftValue = drafts[reply.id] ?? reply.ai_draft ?? ''
            return (
              <article key={reply.id} className="reply-card">
                <header className="reply-card-header">
                  <div>
                    <strong>{fullName(lead)}</strong>
                    <span className="reply-card-meta">
                      {lead?.title || ''}{lead?.district_name ? ` · ${lead.district_name}` : ''}
                    </span>
                  </div>
                  <div className="reply-card-tags">
                    {reply.classification && (
                      <span className={`reply-classification is-${reply.classification}`}>
                        {CLASSIFICATION_LABELS[reply.classification]}
                      </span>
                    )}
                    {lead?.tier && <span className={`tier-badge is-${lead.tier}`}>{TIER_LABEL[lead.tier]}</span>}
                    <span className="reply-time">{relativeTime(reply.received_at)}</span>
                  </div>
                </header>

                <section className="reply-body">
                  <h5>Their reply</h5>
                  <pre>{reply.body}</pre>
                </section>

                {activeTab === 'pending' && reply.classification !== 'unsubscribe' && (
                  <section className="reply-draft">
                    <h5>AI-drafted response</h5>
                    <textarea
                      value={draftValue}
                      onChange={(e) => setDraftFor(reply.id, e.target.value)}
                      onBlur={() => saveDraft(reply.id)}
                      rows={6}
                    />
                    <div className="reply-actions">
                      <button onClick={() => send(reply.id)} disabled={isPending || !draftValue.trim()}>
                        <Send size={14} /> Send reply
                      </button>
                      <button onClick={() => regen(reply.id)} disabled={isPending} className="reply-btn-secondary">
                        <RefreshCw size={14} /> Regenerate
                      </button>
                      <button onClick={() => dismiss(reply.id)} disabled={isPending} className="reply-btn-ghost">
                        Skip
                      </button>
                    </div>
                  </section>
                )}

                {activeTab === 'pending' && reply.classification === 'unsubscribe' && (
                  <div className="reply-unsub-note">
                    Marked unsubscribed — sequence halted automatically. No reply needed.
                    <button onClick={() => dismiss(reply.id)} disabled={isPending}>Mark handled</button>
                  </div>
                )}

                {activeTab === 'responded' && (
                  <div className="reply-responded-stamp">
                    Responded {relativeTime(reply.responded_at)}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
