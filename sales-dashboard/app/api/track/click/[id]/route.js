import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeUpgrade } from '../../../../../lib/leads/status-transitions'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

export const dynamic = 'force-dynamic'

export async function GET(request, context) {
  const supabase = serviceClient()
  const sendId = context.params.id
  const url = new URL(request.url)
  const target = url.searchParams.get('u') || '/'

  try {
    const { data: send } = await supabase
      .from('v2_email_sends')
      .select('id, lead_id')
      .eq('id', sendId)
      .maybeSingle()

    if (send?.lead_id) {
      await supabase.from('v2_email_events').insert({
        lead_id: send.lead_id,
        email_send_id: send.id,
        event_type: 'click',
        metadata: { link: target },
      })

      const { data: lead } = await supabase
        .from('v2_leads')
        .select('id, status, opens_count, clicks_count, unsubscribed')
        .eq('id', send.lead_id)
        .maybeSingle()

      if (lead) {
        const newClicks = (lead.clicks_count || 0) + 1
        const { data: thresholdRow } = await supabase
          .from('v2_settings')
          .select('value')
          .eq('key', 'hot_lead_thresholds')
          .maybeSingle()

        const ctxLead = { ...lead, clicks_count: newClicks }
        const upgrade = computeUpgrade(ctxLead, {
          eventType: 'click',
          hotThresholds: thresholdRow?.value,
        })

        const patch = {
          clicks_count: newClicks,
          last_click_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        }
        if (upgrade) patch.status = upgrade

        await supabase.from('v2_leads').update(patch).eq('id', lead.id)

        await supabase.from('v2_notifications').insert({
          event_type: 'click',
          lead_id: lead.id,
          message: 'Link clicked',
        })

        if (upgrade === 'hot') {
          await supabase.from('v2_notifications').insert({
            event_type: 'hot_lead',
            lead_id: lead.id,
            message: 'Lead promoted to hot via click',
          })
        }
      }
    }
  } catch (err) {
    console.error('click tracking failed:', err)
  }

  return NextResponse.redirect(target)
}
