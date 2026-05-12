import { createClient } from '../../lib/supabase/server'
import Sidebar from '../../components/Sidebar'
import Header from '../../components/Header'
import ChatBubble from '../../components/ChatBubble'

export default async function DashboardLayout({ children }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="dashboard-main">
        <Header userEmail={user?.email} />
        <main className="dashboard-content">{children}</main>
      </div>
      <ChatBubble />
    </div>
  )
}
