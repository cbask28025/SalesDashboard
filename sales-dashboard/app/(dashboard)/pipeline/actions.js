'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'
import { renderTemplate, buildMergeVars, SAMPLE_LEAD_FOR_PREVIEW } from '../../../lib/email/templates'
import { sendMail } from '../../../lib/graph/client'

const MAX_TEMPLATES = 5

async function fetchActive(supabase) {
  const { data, error } = await supabase
    .from('v2_email_templates')
    .select('*')
    .eq('is_active', true)
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

export async function createTemplate({ insertAfterId = null, name, subjectTemplate, bodyTemplate, delayDays }) {
  const supabase = createClient()
  const active = await fetchActive(supabase)
  if (active.length >= MAX_TEMPLATES) {
    return { ok: false, error: `Pipeline is at the ${MAX_TEMPLATES}-email limit` }
  }

  let position
  if (insertAfterId === null) {
    // Append at end
    position = active.length === 0 ? 1 : active[active.length - 1].position + 1
  } else {
    const idx = active.findIndex((t) => t.id === insertAfterId)
    if (idx === -1) return { ok: false, error: 'insertAfterId not found' }
    const prev = active[idx].position
    const next = idx + 1 < active.length ? active[idx + 1].position : prev + 1
    position = (prev + next) / 2
  }

  const { data, error } = await supabase
    .from('v2_email_templates')
    .insert({
      name: name || `Email ${active.length + 1}`,
      subject_template: subjectTemplate || 'New email subject',
      body_template: bodyTemplate || '<p>Hi {first_name},</p>\n<p>Write your email here…</p>',
      delay_days: delayDays ?? 3,
      position,
      is_active: true,
    })
    .select()
    .single()
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pipeline')
  return { ok: true, template: data }
}

export async function updateTemplate(id, patch) {
  const supabase = createClient()
  const allowed = {}
  if (typeof patch.name === 'string') allowed.name = patch.name
  if (typeof patch.subject_template === 'string') allowed.subject_template = patch.subject_template
  if (typeof patch.body_template === 'string') allowed.body_template = patch.body_template
  if (typeof patch.delay_days === 'number') allowed.delay_days = patch.delay_days
  if (typeof patch.is_active === 'boolean') allowed.is_active = patch.is_active

  const { error } = await supabase.from('v2_email_templates').update(allowed).eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pipeline')
  return { ok: true }
}

export async function deleteTemplate(id) {
  const supabase = createClient()
  // Soft-delete: just deactivate. v2_email_sends.template_id keeps the historical link.
  const { error } = await supabase
    .from('v2_email_templates')
    .update({ is_active: false })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pipeline')
  return { ok: true }
}

export async function reorderTemplates(orderedIds) {
  const supabase = createClient()
  // Assign sequential integer positions in the new order.
  const updates = orderedIds.map((id, idx) => ({ id, position: idx + 1 }))
  for (const u of updates) {
    const { error } = await supabase
      .from('v2_email_templates')
      .update({ position: u.position })
      .eq('id', u.id)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/pipeline')
  return { ok: true }
}

export async function testSendTemplate({ templateId, toEmail, firstName }) {
  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return { ok: false, error: 'Valid email required' }
  }

  const supabase = createClient()
  const { data: template, error } = await supabase
    .from('v2_email_templates')
    .select('*')
    .eq('id', templateId)
    .single()
  if (error || !template) return { ok: false, error: 'Template not found' }

  // No tracking on test sends — clean copy.
  const sampleLead = {
    ...SAMPLE_LEAD_FOR_PREVIEW,
    first_name: firstName?.trim() || SAMPLE_LEAD_FOR_PREVIEW.first_name,
  }
  const { subject, htmlBody } = renderTemplate(template, sampleLead)

  try {
    await sendMail(supabase, {
      to: toEmail,
      subject: `[TEST] ${subject}`,
      htmlBody: `<div style="background:#FBF3E2;padding:8px 12px;margin-bottom:16px;border-left:3px solid #D9A047;font-size:13px;color:#1F2A44;">This is a test send from the CTB Sales Dashboard — tracking pixel + click rewriting are NOT included.</div>${htmlBody}`,
    })
    return { ok: true, sentTo: toEmail }
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Test send failed',
      code: err?.code || null,
      hint: err?.hint || null,
      status: err?.status || null,
    }
  }
}
