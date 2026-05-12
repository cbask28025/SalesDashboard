import { createClient } from '../../../lib/supabase/server'
import TaskBoard from './task-board'

export const metadata = { title: 'Task Board — CTB Sales Dashboard' }

export default async function TasksPage() {
  const supabase = createClient()
  const { data: tasks } = await supabase
    .from('v2_tasks')
    .select('*, v2_leads(id, first_name, last_name, district_name, email)')
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div className="page-shell">
      <div className="page-heading">
        <h2>Task Board</h2>
        <p>Approve AI-suggested actions, track to-dos, and check work off as you go.</p>
      </div>
      <TaskBoard initialTasks={tasks || []} />
    </div>
  )
}
