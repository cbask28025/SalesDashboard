import { createClient } from '@supabase/supabase-js'
import { computeUpgrade } from '../../../../../lib/leads/status-transitions'

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

export const dynamic = 'force-dynamic'

export async function GET(_request, context) {
  const supabase = serviceClient()
  const rawId = context.params.id || ''
  const sendId = rawId.replace(/\.(gif|png|jpg)$/i, '')

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
        event_type: 'open',
      })

      const { data: lead } = await supabase
        .from('v2_leads')
        .select('id, status, opens_count, clicks_count, unsubscribed')
        .eq('id', send.lead_id)
        .maybeSingle()

      if (lead) {
        const newOpens = (lead.opens_count || 0) + 1
        const { data: thresholdRow } = await supabase
          .from('v2_settings')
          .select('value')
          .eq('key', 'hot_lead_thresholds')
          .maybeSingle()

        const ctxLead = { ...lead, opens_count: newOpens }
        const upgrade = computeUpgrade(ctxLead, {
          eventType: 'open',
          hotThresholds: thresholdRow?.value,
        })

        const patch = {
          opens_count: newOpens,
          last_open_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        }
        if (upgrade) patch.status = upgrade

        await supabase.from('v2_leads').update(patch).eq('id', lead.id)

        if (upgrade === 'hot') {
          await supabase.from('v2_notifications').insert({
            event_type: 'hot_lead',
            lead_id: lead.id,
            message: `Lead promoted to hot via opens`,
          })
        }
      }
    }
  } catch (err) {
    console.error('open tracking failed:', err)
  }

  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Length': String(TRANSPARENT_GIF.length),
    },
  })
}
