import { createClient } from '../../../lib/supabase/server'
import PipelineEditor from './pipeline-editor'

export const metadata = { title: 'Email Pipeline — CTB Sales Dashboard' }

export default async function PipelinePage() {
  const supabase = createClient()
  const { data: templates } = await supabase
    .from('v2_email_templates')
    .select('*')
    .eq('is_active', true)
    .order('position', { ascending: true })

  return (
    <div className="page-shell">
      <div className="page-heading">
        <h2>Email Pipeline</h2>
        <p>Configure the email sequence sent to every lead. Max 5 emails. Edit, reorder, or test-send before going live.</p>
      </div>
      <PipelineEditor initialTemplates={templates || []} />
    </div>
  )
}
