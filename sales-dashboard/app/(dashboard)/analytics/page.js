import { createClient } from '../../../lib/supabase/server'
import AnalyticsView from './analytics-view'

export const metadata = { title: 'Analytics — CTB Sales Dashboard' }

function startOfMonthIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

async function loadStats(supabase, range) {
  const sinceIso = range === 'month' ? startOfMonthIso() : '1970-01-01T00:00:00Z'

  const [
    leadsTotal, leadsHot,
    sendsTotal,
    rawEvents,
    leadsByStatus,
    recentEvents,
  ] = await Promise.all([
    supabase.from('v2_leads').select('id', { count: 'exact', head: true }),
    supabase.from('v2_leads').select('id', { count: 'exact', head: true }).eq('status', 'hot'),
    supabase.from('v2_email_sends').select('id', { count: 'exact', head: true }).gte('sent_at', sinceIso),
    supabase.from('v2_email_events').select('event_type, email_send_id').gte('occurred_at', sinceIso),
    supabase.from('v2_leads').select('status'),
    supabase
      .from('v2_email_events')
      .select('id, event_type, occurred_at, v2_leads(id, first_name, last_name, email), v2_email_sends(email_template)')
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: false })
      .limit(50),
  ])

  // Count UNIQUE sends per event type so rates can never exceed 100%.
  // (A single email opened 3 times only counts as one "opened send".)
  const uniqueOpens = new Set()
  const uniqueClicks = new Set()
  const uniqueReplies = new Set()
  const eventTotals = { open: 0, click: 0, reply: 0, bounce: 0, unsubscribe: 0 }
  for (const e of rawEvents.data || []) {
    if (eventTotals[e.event_type] !== undefined) eventTotals[e.event_type]++
    if (!e.email_send_id) continue
    if (e.event_type === 'open') uniqueOpens.add(e.email_send_id)
    else if (e.event_type === 'click') uniqueClicks.add(e.email_send_id)
    else if (e.event_type === 'reply') uniqueReplies.add(e.email_send_id)
  }

  const statusBreakdown = {}
  for (const l of leadsByStatus.data || []) {
    statusBreakdown[l.status] = (statusBreakdown[l.status] || 0) + 1
  }

  return {
    range,
    totals: {
      leads: leadsTotal.count || 0,
      hot: leadsHot.count || 0,
      sendsInRange: sendsTotal.count || 0,
    },
    events: {
      // raw totals (used for funnel chart so multiple-opens still affect the funnel shape)
      totals: eventTotals,
      // unique-by-send counts (used for rate %s)
      unique: {
        open: uniqueOpens.size,
        click: uniqueClicks.size,
        reply: uniqueReplies.size,
      },
    },
    statusBreakdown,
    recentEvents: recentEvents.data || [],
  }
}

export default async function AnalyticsPage({ searchParams }) {
  const range = searchParams?.range === 'all' ? 'all' : 'month'
  const supabase = createClient()
  const stats = await loadStats(supabase, range)

  return (
    <div className="page-shell">
      <div className="page-heading">
        <h2>Analytics</h2>
        <p>Pipeline health at a glance.</p>
      </div>
      <AnalyticsView stats={stats} />
    </div>
  )
}
