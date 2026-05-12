import { createClient } from '../../../lib/supabase/server'
import UploadForm from './upload-form'
import ImportHistory from './import-history'

export const metadata = { title: 'Upload — CTB Sales Dashboard' }

async function loadImports() {
  const supabase = createClient()
  const { data: imports } = await supabase
    .from('v2_imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  // Rollback eligibility: an import is rollback-eligible when at least one lead
  // remains from its batch AND no emails have been sent to any of those leads.
  // We approximate by finding the most recent import_batch_id per filename via
  // the leads table — imports don't store batch_id directly to keep them light.
  const list = imports || []
  if (list.length === 0) return { imports: [], rollbackEligibility: {} }

  const sinceIso = list[list.length - 1].created_at
  const { data: batches } = await supabase
    .from('v2_leads')
    .select('import_batch_id, source, created_at')
    .gte('created_at', sinceIso)

  // Pick the most recent batch per source filename.
  const batchByFilename = {}
  for (const row of batches || []) {
    if (!row.import_batch_id || !row.source) continue
    const existing = batchByFilename[row.source]
    if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
      batchByFilename[row.source] = row
    }
  }

  const candidateBatchIds = Object.values(batchByFilename).map((b) => b.import_batch_id)
  let sentBatchSet = new Set()
  if (candidateBatchIds.length > 0) {
    const { data: sentLeads } = await supabase
      .from('v2_email_sends')
      .select('v2_leads!inner(import_batch_id)')
      .in('v2_leads.import_batch_id', candidateBatchIds)
    sentBatchSet = new Set(
      (sentLeads || []).map((r) => r.v2_leads?.import_batch_id).filter(Boolean)
    )
  }

  const rollbackEligibility = {}
  for (const imp of list) {
    const batch = batchByFilename[imp.filename]
    const batchId = batch?.import_batch_id ?? null
    if (!batchId || imp.added_count === 0) {
      rollbackEligibility[imp.id] = { batchId: null, canRollback: false, reason: 'No leads to roll back' }
    } else if (sentBatchSet.has(batchId)) {
      rollbackEligibility[imp.id] = {
        batchId,
        canRollback: false,
        reason: 'Cannot rollback — emails have been sent to this batch',
      }
    } else {
      rollbackEligibility[imp.id] = { batchId, canRollback: true }
    }
  }

  return { imports: list, rollbackEligibility }
}

export default async function UploadPage() {
  const { imports, rollbackEligibility } = await loadImports()

  return (
    <div className="page-shell">
      <div className="page-heading">
        <h2>Upload</h2>
        <p>Bring new leads into the pipeline. We auto-detect columns by value pattern and classify titles into tiers.</p>
      </div>

      <UploadForm />

      <ImportHistory imports={imports} rollbackEligibility={rollbackEligibility} />
    </div>
  )
}
