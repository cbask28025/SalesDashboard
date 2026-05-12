import { createClient } from '../../../lib/supabase/server'
import RepliesList from './replies-list'

export const metadata = { title: 'Replies — CTB Sales Dashboard' }

export default async function RepliesPage({ searchParams }) {
  const tab = searchParams?.tab === 'responded' ? 'responded' : 'pending'
  const supabase = createClient()

  const { data: replies } = await supabase
    .from('v2_replies')
    .select('*, v2_leads(*)')
    .eq('status', tab)
    .order('received_at', { ascending: false })
    .limit(200)

  const counts = {}
  for (const status of ['pending', 'responded']) {
    const { count } = await supabase
      .from('v2_replies')
      .select('id', { count: 'exact', head: true })
      .eq('status', status)
    counts[status] = count || 0
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <h2>Replies</h2>
        <p>Manage inbound replies. AI classifies and drafts a response; you review, edit, and send.</p>
      </div>
      <RepliesList replies={replies || []} activeTab={tab} counts={counts} />
    </div>
  )
}
