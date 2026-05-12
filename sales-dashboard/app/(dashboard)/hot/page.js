import { createClient } from '../../../lib/supabase/server'
import HotLeadsList from './hot-leads-list'

export const metadata = { title: 'Hot Leads — CTB Sales Dashboard' }

export default async function HotLeadsPage() {
  const supabase = createClient()
  const { data: leads } = await supabase
    .from('v2_leads')
    .select('*')
    .eq('status', 'hot')
    .order('last_activity_at', { ascending: false, nullsFirst: false })

  const leadIds = (leads || []).map((l) => l.id)
  const [{ data: replies }, { data: pinnedNotes }] = await Promise.all([
    supabase
      .from('v2_replies')
      .select('*')
      .in('lead_id', leadIds.length > 0 ? leadIds : ['00000000-0000-0000-0000-000000000000'])
      .order('received_at', { ascending: false }),
    supabase
      .from('v2_lead_notes')
      .select('*')
      .eq('pinned', true)
      .in('lead_id', leadIds.length > 0 ? leadIds : ['00000000-0000-0000-0000-000000000000'])
      .order('updated_at', { ascending: false }),
  ])

  const latestReplyByLead = {}
  for (const r of replies || []) {
    if (!latestReplyByLead[r.lead_id]) latestReplyByLead[r.lead_id] = r
  }
  const pinnedNoteByLead = {}
  for (const n of pinnedNotes || []) {
    if (!pinnedNoteByLead[n.lead_id]) pinnedNoteByLead[n.lead_id] = n
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <h2>Hot Leads</h2>
        <p>{(leads || []).length} leads showing buying signals — sorted by most recent activity.</p>
      </div>
      <HotLeadsList
        leads={leads || []}
        latestReplyByLead={latestReplyByLead}
        pinnedNoteByLead={pinnedNoteByLead}
      />
    </div>
  )
}
