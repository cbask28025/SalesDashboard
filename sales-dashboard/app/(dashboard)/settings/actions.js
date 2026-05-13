'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'
import { getStoredTokens } from '../../../lib/graph/tokens'
import { sendMail } from '../../../lib/graph/client'

const ALLOWED_KEYS = new Set([
  'hot_lead_thresholds', 'sending_rules',
  'notification_prefs', 'assistant_system_prompt',
])

const MAX_DOC_CHARS = 50_000  // ~12 pages of text — plenty for case studies, FAQs, pricing sheets

export async function saveSettings(updates) {
  const supabase = createClient()
  const rows = []
  for (const [key, value] of Object.entries(updates || {})) {
    if (!ALLOWED_KEYS.has(key)) continue
    rows.push({ key, value, updated_at: new Date().toISOString() })
  }
  if (rows.length === 0) return { ok: false, error: 'No valid settings to save' }
  const { error } = await supabase.from('v2_settings').upsert(rows, { onConflict: 'key' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings')
  return { ok: true, count: rows.length }
}

export async function sendTestEmail() {
  const supabase = createClient()
  const tokens = await getStoredTokens(supabase)
  if (!tokens?.account_email) return { ok: false, error: 'Outlook is not connected' }

  try {
    await sendMail(supabase, {
      to: tokens.account_email,
      subject: 'CTB Sales Dashboard — Test send',
      htmlBody: '<p>This is a test email sent from the CTB Sales Dashboard. Your Outlook connection is working.</p>',
    })
    return { ok: true, sentTo: tokens.account_email }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// ============================================================
// AI reference documents
// ============================================================

export async function addReferenceDocument({ name, purpose, content, filename, fileSizeBytes }) {
  if (!name?.trim()) return { ok: false, error: 'Name is required' }
  if (!purpose?.trim()) return { ok: false, error: 'Purpose is required (so the AI knows when to use it)' }
  if (!content?.trim()) return { ok: false, error: 'Document content is required' }
  if (content.length > MAX_DOC_CHARS) {
    return { ok: false, error: `Document is too long (${content.length} chars, max ${MAX_DOC_CHARS}). Trim it before saving.` }
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('v2_ai_documents')
    .insert({
      name: name.trim(),
      purpose: purpose.trim(),
      content: content.trim(),
      filename: filename || null,
      file_size_bytes: fileSizeBytes || content.length,
      is_active: true,
    })
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings')
  return { ok: true, document: data }
}

export async function updateReferenceDocument(id, patch) {
  const supabase = createClient()
  const allowed = {}
  if (typeof patch.name === 'string') allowed.name = patch.name.trim()
  if (typeof patch.purpose === 'string') allowed.purpose = patch.purpose.trim()
  if (typeof patch.content === 'string') {
    if (patch.content.length > MAX_DOC_CHARS) {
      return { ok: false, error: `Document too long (max ${MAX_DOC_CHARS} chars)` }
    }
    allowed.content = patch.content
    allowed.file_size_bytes = patch.content.length
  }
  if (typeof patch.is_active === 'boolean') allowed.is_active = patch.is_active

  const { error } = await supabase.from('v2_ai_documents').update(allowed).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings')
  return { ok: true }
}

export async function deleteReferenceDocument(id) {
  const supabase = createClient()
  const { error } = await supabase.from('v2_ai_documents').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings')
  return { ok: true }
}
