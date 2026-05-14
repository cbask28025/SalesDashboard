'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'
import { sendMail } from '../../../lib/graph/client'
import { renderTemplate } from '../../../lib/email/templates'
import { injectTracking } from '../../../lib/email/tracking'

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

// ============================================================
// One-off "send now" — fires an email immediately, does NOT advance the lead's
// sequence step. Useful for re-engaging warm leads or re-sending Email 1 manually.
// ============================================================

export async function listActiveTemplatesForSendNow() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('v2_email_templates')
    .select('id, name, subject_template, delay_days')
    .eq('is_active', true)
    .order('position', { ascending: true })
  if (error) return { ok: false, error: error.message, templates: [] }
  return { ok: true, templates: data || [] }
}

export async function sendNowToLeads(leadIds, templateId) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return { ok: false, error: 'No leads selected' }
  }
  if (!templateId) return { ok: false, error: 'Pick a template to send' }

  const supabase = createClient()
  const { data: template, error: tmplErr } = await supabase
    .from('v2_email_templates')
    .select('*')
    .eq('id', templateId)
    .single()
  if (tmplErr || !template) return { ok: false, error: 'Template not found' }

  const { data: leads, error: leadsErr } = await supabase
    .from('v2_leads')
    .select('id, email, first_name, last_name, district_name, state, title, unsubscribed, status')
    .in('id', leadIds)
  if (leadsErr) return { ok: false, error: leadsErr.message }

  let sent = 0
  const errors = []
  const skipped = []

  for (const lead of leads || []) {
    if (lead.unsubscribed) {
      skipped.push({ email: lead.email, reason: 'unsubscribed' })
      continue
    }
    try {
      const { subject, htmlBody } = renderTemplate(template, lead)
      const sendId = crypto.randomUUID()
      const trackedBody = injectTracking(htmlBody, sendId)
      const graphResp = await sendMail(supabase, {
        to: lead.email,
        subject,
        htmlBody: trackedBody,
        headers: { 'X-CTB-Send-Id': sendId, 'X-CTB-Manual': '1' },
      })
      await supabase.from('v2_email_sends').insert({
        id: sendId,
        lead_id: lead.id,
        template_id: template.id,
        // Prefix with [Manual] so analytics/timeline can distinguish from sequence sends.
        email_template: `[Manual] ${template.name}`,
        message_id: graphResp.internetMessageId || graphResp.messageId,
        thread_id: graphResp.conversationId,
      })
      // Manual sends do NOT change sequence_step or last_email_sent — they're parallel to the sequence.
      await supabase
        .from('v2_leads')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', lead.id)
      sent++
    } catch (err) {
      errors.push({ email: lead.email, error: err?.message || 'Send failed', code: err?.code || null })
    }
  }

  revalidateLeadViews()
  return { ok: true, sent, errors, skipped, attempted: (leads || []).length }
}

// ============================================================
// Manual lead creation — single lead at a time, not CSV.
// ============================================================

export async function addLead(payload) {
  const email = (payload?.email || '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'Email is required' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Invalid email format' }
  }

  const tier = payload?.tier && ['tier1', 'tier2', 'tier3'].includes(payload.tier) ? payload.tier : 'tier3'
  const status = payload?.status && VALID_STATUSES.has(payload.status) ? payload.status : 'sequencing'

  const supabase = createClient()
  const { data: existing } = await supabase
    .from('v2_leads')
    .select('id, email')
    .eq('email', email)
    .maybeSingle()
  if (existing) {
    return { ok: false, error: 'A lead with this email already exists' }
  }

  const { data, error } = await supabase
    .from('v2_leads')
    .insert({
      email,
      first_name: payload.first_name?.trim() || null,
      last_name: payload.last_name?.trim() || null,
      phone: payload.phone?.trim() || null,
      title: payload.title?.trim() || null,
      district_name: payload.district_name?.trim() || null,
      state: payload.state?.trim()?.toUpperCase().slice(0, 2) || null,
      tier,
      status,
      sequence_step: 0,
      source: 'manual',
    })
    .select()
    .single()
  if (error) return { ok: false, error: error.message }

  revalidateLeadViews()
  return { ok: true, lead: data }
}
