import { createClient } from '../../../lib/supabase/server'
import LeadsList from './leads-list'

export const metadata = { title: 'All Leads — CTB Sales Dashboard' }

export default async function LeadsPage() {
  const supabase = createClient()
  const { data: leads, error } = await supabase
    .from('v2_leads')
    .select('*')
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(5000)

  return (
    <div className="page-shell">
      <div className="page-heading">
        <h2>All Leads</h2>
        <p>The operational workhorse. Filter, select, and act on your pipeline.</p>
      </div>
      {error ? (
        <div className="upload-error">{error.message}</div>
      ) : (
        <LeadsList initialLeads={leads || []} />
      )}
    </div>
  )
}
