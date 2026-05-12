'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'

const VALID_STATUSES = new Set([
  'new', 'sequencing', 'engaged', 'hot', 'warm', 'demo_scheduled',
  'negotiating', 'closed_won', 'closed_lost', 'not_interested',
  'unsubscribed', 'bounced', 'on_hold',
])

function revalidateLeadViews() {
  revalidatePath('/leads')
  revalidatePath('/hot')
  revalidatePath('/analytics')
}

export async function updateLeadStatus(leadIds, status) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) return { ok: false, error: 'No leads selected' }
  if (!VALID_STATUSES.has(status)) return { ok: false, error: `Invalid status: ${status}` }

  const supabase = createClient()
  const patch = { status, last_activity_at: new Date().toISOString() }
  if (status === 'unsubscribed') {
    patch.unsubscribed = true
    patch.unsubscribed_at = new Date().toISOString()
  }
  const { error } = await supabase.from('v2_leads').update(patch).in('id', leadIds)
  if (error) return { ok: false, error: error.message }
  revalidateLeadViews()
  return { ok: true, count: leadIds.length }
}

export async function pauseSequence(leadIds) {
  return updateLeadStatus(leadIds, 'on_hold')
}

export async function resumeSequence(leadIds) {
  return updateLeadStatus(leadIds, 'sequencing')
}

export async function resetPipeline(leadIds) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) return { ok: false, error: 'No leads selected' }
  const supabase = createClient()
  const { error } = await supabase
    .from('v2_leads')
    .update({
      sequence_step: 0,
      status: 'sequencing',
      last_email_sent: null,
      last_activity_at: new Date().toISOString(),
    })
    .in('id', leadIds)
  if (error) return { ok: false, error: error.message }
  revalidateLeadViews()
  return { ok: true, count: leadIds.length }
}

export async function deleteLeads(leadIds) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) return { ok: false, error: 'No leads selected' }
  const supabase = createClient()
  const { error } = await supabase.from('v2_leads').delete().in('id', leadIds)
  if (error) return { ok: false, error: error.message }
  revalidateLeadViews()
  return { ok: true, count: leadIds.length }
}

export async function addNote(leadId, body) {
  if (!leadId || !body?.trim()) return { ok: false, error: 'Note body required' }
  const supabase = createClient()
  const { data, error } = await supabase
    .from('v2_lead_notes')
    .insert({ lead_id: leadId, body: body.trim(), source: 'manual' })
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/leads')
  return { ok: true, note: data }
}

export async function deleteNote(noteId) {
  const supabase = createClient()
  const { error } = await supabase.from('v2_lead_notes').delete().eq('id', noteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/leads')
  return { ok: true }
}

export async function togglePinNote(noteId, pinned) {
  const supabase = createClient()
  const { error } = await supabase
    .from('v2_lead_notes')
    .update({ pinned })
    .eq('id', noteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/leads')
  return { ok: true }
}

export async function fetchLeadDetail(leadId) {
  const supabase = createClient()
  const [{ data: notes }, { data: sends }, { data: events }, { data: replies }] = await Promise.all([
    supabase.from('v2_lead_notes').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
    supabase.from('v2_email_sends').select('*').eq('lead_id', leadId).order('sent_at', { ascending: false }),
    supabase.from('v2_email_events').select('*').eq('lead_id', leadId).order('occurred_at', { ascending: false }),
    supabase.from('v2_replies').select('*').eq('lead_id', leadId).order('received_at', { ascending: false }),
  ])
  return { notes: notes || [], sends: sends || [], events: events || [], replies: replies || [] }
}
