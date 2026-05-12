'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'
import { classifyTitles } from '../../../lib/anthropic/classify-titles'

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeRow(row) {
  return {
    email: (row.email || '').trim().toLowerCase(),
    first_name: row.first_name?.trim() || null,
    last_name: row.last_name?.trim() || null,
    phone: row.phone?.trim() || null,
    title: row.title?.trim() || null,
    district_name: row.district_name?.trim() || null,
    state: row.state?.trim()?.toUpperCase().slice(0, 2) || null,
  }
}

export async function commitImport({ filename, rows }) {
  const supabase = createClient()

  const total = rows.length
  const normalized = rows.map(normalizeRow)
  const validRows = normalized.filter((r) => VALID_EMAIL.test(r.email))
  const invalidCount = total - validRows.length

  const seenInBatch = new Set()
  const uniqueByEmail = []
  for (const r of validRows) {
    if (seenInBatch.has(r.email)) continue
    seenInBatch.add(r.email)
    uniqueByEmail.push(r)
  }
  const intraBatchDupes = validRows.length - uniqueByEmail.length

  let dbDupes = 0
  let fresh = uniqueByEmail
  let importBatchId = null

  if (uniqueByEmail.length > 0) {
    const emails = uniqueByEmail.map((r) => r.email)
    const { data: existing } = await supabase
      .from('v2_leads')
      .select('email')
      .in('email', emails)
    const existingSet = new Set((existing || []).map((e) => e.email))
    fresh = uniqueByEmail.filter((r) => !existingSet.has(r.email))
    dbDupes = uniqueByEmail.length - fresh.length
  }

  if (fresh.length > 0) {
    const titles = fresh.map((r) => r.title).filter(Boolean)
    const tierMap = await classifyTitles(supabase, titles)

    importBatchId = crypto.randomUUID()
    const toInsert = fresh.map((r) => ({
      ...r,
      tier: r.title ? tierMap[r.title.trim()] || 'tier3' : 'tier3',
      status: 'sequencing',
      sequence_step: 0,
      source: filename,
      import_batch_id: importBatchId,
    }))

    const { error: insertErr } = await supabase.from('v2_leads').insert(toInsert)
    if (insertErr) {
      await supabase.from('v2_imports').insert({
        filename,
        total_rows: total,
        added_count: 0,
        duplicate_count: intraBatchDupes + dbDupes,
        invalid_count: invalidCount,
        status: 'failed',
      })
      return { ok: false, error: insertErr.message }
    }
  }

  const duplicates = intraBatchDupes + dbDupes
  const added = fresh.length
  const status =
    invalidCount === total ? 'failed' :
    invalidCount > 0 || duplicates > 0 ? (added === 0 ? 'partial' : 'partial') :
    'success'

  await supabase.from('v2_imports').insert({
    filename,
    total_rows: total,
    added_count: added,
    duplicate_count: duplicates,
    invalid_count: invalidCount,
    status,
  })

  revalidatePath('/upload')
  revalidatePath('/leads')
  revalidatePath('/analytics')
  return { ok: true, added, duplicates, invalid: invalidCount, importBatchId }
}

export async function rollbackImport(importBatchId) {
  const supabase = createClient()

  const { data: leads } = await supabase
    .from('v2_leads')
    .select('id')
    .eq('import_batch_id', importBatchId)

  const leadIds = (leads || []).map((l) => l.id)
  if (leadIds.length === 0) {
    return { ok: false, error: 'No leads found for this import batch' }
  }

  const { count } = await supabase
    .from('v2_email_sends')
    .select('id', { count: 'exact', head: true })
    .in('lead_id', leadIds)

  if ((count ?? 0) > 0) {
    return { ok: false, error: 'Cannot rollback — emails have been sent to leads in this batch' }
  }

  const { error } = await supabase
    .from('v2_leads')
    .delete()
    .eq('import_batch_id', importBatchId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/upload')
  revalidatePath('/leads')
  return { ok: true, deleted: leadIds.length }
}
