'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'
import { sendReply as graphSendReply } from '../../../lib/graph/client'
import { draftReply } from '../../../lib/anthropic/replies'

export async function sendReplyAction(replyId) {
  const supabase = createClient()
  const { data: reply, error } = await supabase
    .from('v2_replies')
    .select('*, v2_leads(*)')
    .eq('id', replyId)
    .single()
  if (error || !reply) return { ok: false, error: error?.message || 'Reply not found' }
  if (!reply.ai_draft?.trim()) return { ok: false, error: 'Draft body is empty' }

  // Find the original Graph message id we replied to so the thread is preserved.
  const { data: send } = await supabase
    .from('v2_email_sends')
    .select('message_id')
    .eq('thread_id', reply.thread_id)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  try {
    const htmlBody = `<div>${reply.ai_draft.replace(/\n/g, '<br/>')}</div>`
    const graphResp = send?.message_id
      ? await graphSendReply(supabase, { graphMessageId: send.message_id, htmlBody })
      : null

    await supabase
      .from('v2_replies')
      .update({ status: 'responded', responded_at: new Date().toISOString() })
      .eq('id', replyId)

    if (graphResp) {
      await supabase.from('v2_email_sends').insert({
        lead_id: reply.lead_id,
        email_template: 'reply',
        message_id: graphResp.internetMessageId || graphResp.messageId,
        thread_id: graphResp.conversationId || reply.thread_id,
      })
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }

  revalidatePath('/replies')
  revalidatePath('/hot')
  return { ok: true }
}

export async function updateDraft(replyId, draft) {
  const supabase = createClient()
  const { error } = await supabase
    .from('v2_replies')
    .update({ ai_draft: draft })
    .eq('id', replyId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/replies')
  return { ok: true }
}

export async function dismissReply(replyId) {
  const supabase = createClient()
  const { error } = await supabase
    .from('v2_replies')
    .update({ status: 'dismissed' })
    .eq('id', replyId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/replies')
  return { ok: true }
}

export async function regenerateDraft(replyId) {
  const supabase = createClient()
  const { data: reply } = await supabase
    .from('v2_replies')
    .select('*, v2_leads(*)')
    .eq('id', replyId)
    .single()
  if (!reply) return { ok: false, error: 'Reply not found' }

  const fresh = await draftReply(supabase, reply.body, reply.v2_leads, reply.classification || 'question')
  await supabase.from('v2_replies').update({ ai_draft: fresh }).eq('id', replyId)
  revalidatePath('/replies')
  return { ok: true, draft: fresh }
}
