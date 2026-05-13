import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '../../../../lib/cron/auth'
import { listInboxMessages } from '../../../../lib/graph/client'
import { classifyReply, draftReply, suggestTaskFromReply } from '../../../../lib/anthropic/replies'
import { computeUpgrade } from '../../../../lib/leads/status-transitions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

async function loadCursor(supabase) {
  const { data } = await supabase
    .from('v2_settings')
    .select('value')
    .eq('key', 'reply_poll_cursor')
    .maybeSingle()
  return data?.value?.last_polled_at || null
}

async function saveCursor(supabase, iso) {
  await supabase
    .from('v2_settings')
    .upsert({ key: 'reply_poll_cursor', value: { last_polled_at: iso } }, { onConflict: 'key' })
}

function extractHeaderValue(headers, name) {
  if (!Array.isArray(headers)) return null
  const lowered = name.toLowerCase()
  const row = headers.find((h) => h.name?.toLowerCase() === lowered)
  return row?.value || null
}

function extractParentMessageIds(headers) {
  const inReplyTo = extractHeaderValue(headers, 'In-Reply-To')
  const references = extractHeaderValue(headers, 'References')
  const ids = []
  if (inReplyTo) ids.push(inReplyTo.trim())
  if (references) {
    references.split(/\s+/).forEach((r) => {
      const cleaned = r.trim()
      if (cleaned && !ids.includes(cleaned)) ids.push(cleaned)
    })
  }
  return ids
}

function plainTextFromHtml(html) {
  if (!html) return ''
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function POST(request) { return run(request) }
export async function GET(request) { return run(request) }

async function run(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()
  const cursor = await loadCursor(supabase)
  const sinceIso = cursor || new Date(Date.now() - 60 * 60 * 1000).toISOString()

  let messages
  try {
    messages = await listInboxMessages(supabase, { sinceIso, top: 50 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }

  let matched = 0
  let processed = 0
  const errors = []
  let latestSeen = sinceIso

  for (const msg of messages) {
    if (msg.receivedDateTime && msg.receivedDateTime > latestSeen) {
      latestSeen = msg.receivedDateTime
    }

    const parentIds = extractParentMessageIds(msg.internetMessageHeaders)
    if (parentIds.length === 0) continue

    // Find the send this reply targets.
    const { data: send } = await supabase
      .from('v2_email_sends')
      .select('id, lead_id, thread_id')
      .in('message_id', parentIds)
      .maybeSingle()

    if (!send) continue
    matched++

    // Dedupe: don't double-process the same Graph message.
    const { data: existing } = await supabase
      .from('v2_replies')
      .select('id')
      .eq('in_reply_to', msg.internetMessageId || msg.id)
      .maybeSingle()
    if (existing) continue

    try {
      const body = plainTextFromHtml(msg.body?.content) || msg.bodyPreview || ''
      const { data: lead } = await supabase
        .from('v2_leads')
        .select('*')
        .eq('id', send.lead_id)
        .maybeSingle()
      if (!lead) continue

      const { classification, summary } = await classifyReply(supabase, body, lead)
      const aiDraft = classification === 'unsubscribe'
        ? null
        : await draftReply(supabase, body, lead, classification)

      const { data: replyRow } = await supabase
        .from('v2_replies')
        .insert({
          lead_id: send.lead_id,
          thread_id: send.thread_id || msg.conversationId,
          in_reply_to: msg.internetMessageId || msg.id,
          body,
          classification,
          ai_draft: aiDraft,
          status: 'pending',
        })
        .select()
        .single()

      await supabase.from('v2_email_events').insert({
        lead_id: send.lead_id,
        email_send_id: send.id,
        event_type: 'reply',
        metadata: { classification, summary },
      })

      // Lead state update: ANY reply → hot, unless unsubscribe (then halt).
      const replyPatch = {
        replies_count: (lead.replies_count || 0) + 1,
        last_reply_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      }
      if (classification === 'unsubscribe') {
        replyPatch.unsubscribed = true
        replyPatch.unsubscribed_at = new Date().toISOString()
        replyPatch.status = 'unsubscribed'
      } else {
        const upgrade = computeUpgrade(lead, { isReply: true })
        if (upgrade) replyPatch.status = upgrade
      }
      await supabase.from('v2_leads').update(replyPatch).eq('id', lead.id)

      await supabase.from('v2_notifications').insert({
        event_type: 'reply',
        lead_id: lead.id,
        message: `New reply from ${lead.first_name || lead.email} (${classification})`,
      })

      const taskSuggestion = await suggestTaskFromReply(supabase, body, lead, classification)
      if (taskSuggestion) {
        await supabase.from('v2_tasks').insert({
          lead_id: lead.id,
          title: taskSuggestion.title,
          description: taskSuggestion.description,
          due_date: taskSuggestion.due_date,
          status: 'suggested',
          source: 'ai_reply',
        })
        await supabase.from('v2_notifications').insert({
          event_type: 'task_suggested',
          lead_id: lead.id,
          message: `AI suggested a task: ${taskSuggestion.title}`,
        })
      }

      processed++
    } catch (err) {
      console.error('Reply processing failed:', err)
      errors.push({ messageId: msg.internetMessageId || msg.id, error: err.message })
    }
  }

  await saveCursor(supabase, latestSeen)
  return NextResponse.json({ ok: true, scanned: messages.length, matched, processed, errors })
}
