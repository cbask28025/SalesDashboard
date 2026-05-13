import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '../../../../lib/cron/auth'
import { withinSendingWindow, startOfTzDayUtcIso } from '../../../../lib/cron/sending-window'
import { sendMail } from '../../../../lib/graph/client'
import { loadActiveTemplates, renderTemplate } from '../../../../lib/email/templates'
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
  const rules = await loadSetting(supabase, 'sending_rules', {})

  const now = new Date()
  if (!withinSendingWindow(now, rules)) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'outside sending window' })
  }

  const templates = await loadActiveTemplates(supabase)
  if (templates.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no active templates' })
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

  const { data: candidates, error } = await supabase
    .from('v2_leads')
    .select('id, email, first_name, last_name, district_name, state, title, sequence_step, status')
    .eq('status', 'sequencing')
    .eq('unsubscribed', false)
    .lt('sequence_step', templates.length)
    .limit(remaining * 3)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const eligibleIds = candidates.map((c) => c.id)
  const lastSendByLead = {}
  if (eligibleIds.length > 0) {
    const { data: sends } = await supabase
      .from('v2_email_sends')
      .select('lead_id, sent_at')
      .in('lead_id', eligibleIds)
      .order('sent_at', { ascending: false })
    for (const s of sends || []) {
      if (!lastSendByLead[s.lead_id]) lastSendByLead[s.lead_id] = s.sent_at
    }
  }

  const eligible = candidates.filter((lead) => {
    const nextRank = lead.sequence_step ?? 0
    const nextTemplate = templates[nextRank]
    if (!nextTemplate) return false
    const gapMs = (nextTemplate.delay_days || 0) * 86400000
    const last = lastSendByLead[lead.id]
    if (!last) return gapMs === 0  // step 1 with 0-day delay sends immediately on entry
    return now.getTime() - new Date(last).getTime() >= gapMs
  }).slice(0, remaining)

  let sent = 0
  const errors = []

  for (const lead of eligible) {
    const nextRank = lead.sequence_step ?? 0
    const template = templates[nextRank]
    if (!template) continue

    try {
      const { subject, htmlBody } = renderTemplate(template, lead)
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
        template_id: template.id,
        email_template: template.name,
        message_id: graphResp.internetMessageId || graphResp.messageId,
        thread_id: graphResp.conversationId,
      })

      const newStep = nextRank + 1
      await supabase
        .from('v2_leads')
        .update({
          sequence_step: newStep,
          last_email_sent: template.name,
          last_activity_at: new Date().toISOString(),
          sequence_completed_at: newStep >= templates.length ? new Date().toISOString() : null,
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
