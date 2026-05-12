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
    leadsTotal, leadsSequencing, leadsHot,
    sendsTotal, sendsThisMonth,
    eventsByType,
    leadsByStatus,
    recentEvents,
  ] = await Promise.all([
    supabase.from('v2_leads').select('id', { count: 'exact', head: true }),
    supabase.from('v2_leads').select('id', { count: 'exact', head: true }).eq('status', 'sequencing'),
    supabase.from('v2_leads').select('id', { count: 'exact', head: true }).eq('status', 'hot'),
    supabase.from('v2_email_sends').select('id', { count: 'exact', head: true }).gte('sent_at', sinceIso),
    supabase.from('v2_email_sends').select('id', { count: 'exact', head: true }).gte('sent_at', startOfMonthIso()),
    supabase.from('v2_email_events').select('event_type').gte('occurred_at', sinceIso),
    supabase.from('v2_leads').select('status'),
    supabase
      .from('v2_email_events')
      .select('id, event_type, occurred_at, v2_leads(id, first_name, last_name, email), v2_email_sends(email_template)')
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: false })
      .limit(50),
  ])

  const eventCounts = { open: 0, click: 0, reply: 0, bounce: 0, unsubscribe: 0 }
  for (const e of eventsByType.data || []) {
    if (eventCounts[e.event_type] !== undefined) eventCounts[e.event_type]++
  }

  const statusBreakdown = {}
  for (const l of leadsByStatus.data || []) {
    statusBreakdown[l.status] = (statusBreakdown[l.status] || 0) + 1
  }

  return {
    range,
    totals: {
      leads: leadsTotal.count || 0,
      sequencing: leadsSequencing.count || 0,
      hot: leadsHot.count || 0,
      sendsInRange: sendsTotal.count || 0,
      sendsThisMonth: sendsThisMonth.count || 0,
    },
    events: eventCounts,
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
