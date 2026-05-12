import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '../../../../lib/cron/auth'
import { withinSendingWindow, startOfTzDayUtcIso } from '../../../../lib/cron/sending-window'
import { sendMail } from '../../../../lib/graph/client'
import { templateForStep, renderTemplate } from '../../../../lib/email/templates'
import { injectTracking } from '../../../../lib/email/tracking'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

async function loadSetting(supabase, key, fallback) {
  const { data } = await supabase
    .from('v2_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  return data?.value ?? fallback
}

export async function POST(request) { return run(request) }
export async function GET(request) { return run(request) }

async function run(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()
  const timing = await loadSetting(supabase, 'sequence_timing', { email_1_to_2_days: 3, email_2_to_3_days: 5 })
  const rules = await loadSetting(supabase, 'sending_rules', {})

  const now = new Date()
  if (!withinSendingWindow(now, rules)) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'outside sending window' })
  }

  const tz = rules.timezone || 'America/New_York'
  const startOfDay = startOfTzDayUtcIso(now, tz)
  const { count: sentToday } = await supabase
    .from('v2_email_sends')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', startOfDay)

  const dailyLimit = rules.daily_limit ?? 50
  const remaining = Math.max(0, dailyLimit - (sentToday || 0))
  if (remaining === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'daily limit reached' })
  }

  // Find candidate leads to advance.
  const { data: candidates, error } = await supabase
    .from('v2_leads')
    .select('id, email, first_name, last_name, district_name, state, sequence_step, last_email_sent_at:last_activity_at, status')
    .eq('status', 'sequencing')
    .eq('unsubscribed', false)
    .lt('sequence_step', 3)
    .limit(remaining * 3) // overfetch to allow gap-based filtering

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const gapMsForStep = (step) => {
    if (step === 0) return 0 // Email 1 sends immediately
    if (step === 1) return (timing.email_1_to_2_days ?? 3) * 86400000
    return (timing.email_2_to_3_days ?? 5) * 86400000
  }

  // For each candidate, fetch the most recent send to enforce gap.
  const eligibleIds = candidates.map((c) => c.id)
  const lastSendsByLead = {}
  if (eligibleIds.length > 0) {
    const { data: sends } = await supabase
      .from('v2_email_sends')
      .select('lead_id, sent_at')
      .in('lead_id', eligibleIds)
      .order('sent_at', { ascending: false })
    for (const s of sends || []) {
      if (!lastSendsByLead[s.lead_id]) lastSendsByLead[s.lead_id] = s.sent_at
    }
  }

  const eligible = candidates.filter((c) => {
    const last = lastSendsByLead[c.id]
    const gap = gapMsForStep(c.sequence_step ?? 0)
    if (!last) return true
    return now.getTime() - new Date(last).getTime() >= gap
  }).slice(0, remaining)

  let sent = 0
  const errors = []

  for (const lead of eligible) {
    const step = lead.sequence_step ?? 0
    const templateKey = templateForStep(step)
    if (!templateKey) continue

    try {
      const { subject, htmlBody } = renderTemplate(templateKey, lead)

      // We need an email_send row id BEFORE inserting tracking pixel/links.
      const sendId = crypto.randomUUID()
      const trackedBody = injectTracking(htmlBody, sendId)

      const graphResp = await sendMail(supabase, {
        to: lead.email,
        subject,
        htmlBody: trackedBody,
        headers: { 'X-CTB-Send-Id': sendId },
      })

      await supabase.from('v2_email_sends').insert({
        id: sendId,
        lead_id: lead.id,
        email_template: templateKey,
        message_id: graphResp.internetMessageId || graphResp.messageId,
        thread_id: graphResp.conversationId,
      })

      await supabase
        .from('v2_leads')
        .update({
          sequence_step: step + 1,
          last_email_sent: templateKey,
          last_activity_at: new Date().toISOString(),
          status: step + 1 >= 3 ? 'sequencing' : 'sequencing', // remains sequencing until events/manual change
          sequence_completed_at: step + 1 >= 3 ? new Date().toISOString() : null,
        })
        .eq('id', lead.id)

      sent++
    } catch (err) {
      console.error('Send failed for', lead.email, err)
      errors.push({ email: lead.email, error: err.message })
    }
  }

  return NextResponse.json({ ok: true, sent, errors, attempted: eligible.length, remaining: remaining - sent })
}
