'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { rollbackImport } from './actions'

export default function ImportHistory({ imports, rollbackEligibility }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState(null)

  function doRollback(batchId) {
    if (!batchId) return
    if (!confirm('Roll back this import? This will permanently delete the imported leads.')) return
    startTransition(async () => {
      const res = await rollbackImport(batchId)
      setFeedback(res.ok
        ? { type: 'ok', message: `Rolled back — ${res.deleted} leads deleted` }
        : { type: 'err', message: res.error || 'Rollback failed' })
    })
  }

  return (
    <section className="import-history">
      <button
        type="button"
        className="import-history-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span>Import history ({imports.length} {imports.length === 1 ? 'import' : 'imports'})</span>
      </button>

      {feedback && (
        <div className={`import-history-feedback is-${feedback.type}`}>{feedback.message}</div>
      )}

      {open && (
        <div className="import-history-body">
          {imports.length === 0 ? (
            <div className="import-history-empty">No imports yet.</div>
          ) : (
            <table className="import-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Filename</th>
                  <th>Total</th>
                  <th>Added</th>
                  <th>Duplicates</th>
                  <th>Invalid</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {imports.map((imp) => {
                  const eligibility = rollbackEligibility[imp.id]
                  return (
                    <tr key={imp.id}>
                      <td>{format(new Date(imp.created_at), 'MMM d, yyyy h:mm a')}</td>
                      <td>{imp.filename}</td>
                      <td>{imp.total_rows ?? '—'}</td>
                      <td>{imp.added_count ?? 0}</td>
                      <td>{imp.duplicate_count ?? 0}</td>
                      <td>{imp.invalid_count ?? 0}</td>
                      <td>
                        <span className={`import-status-badge is-${imp.status || 'success'}`}>
                          {imp.status || 'success'}
                        </span>
                      </td>
                      <td>
                        {eligibility?.batchId && eligibility.canRollback ? (
                          <button
                            type="button"
                            className="import-rollback-btn"
                            onClick={() => doRollback(eligibility.batchId)}
                            disabled={isPending}
                          >
                            Rollback
                          </button>
                        ) : (
                          <span
                            className="import-rollback-disabled"
                            title={eligibility?.reason || 'No rollback target'}
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}
