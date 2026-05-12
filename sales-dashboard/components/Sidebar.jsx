'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Upload,
  Users,
  Flame,
  MessageSquare,
  CheckSquare,
  Settings,
} from 'lucide-react'

const NAV = [
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/leads', label: 'All Leads', icon: Users },
  { href: '/hot', label: 'Hot Leads', icon: Flame },
  { href: '/replies', label: 'Replies', icon: MessageSquare },
  { href: '/tasks', label: 'Task Board', icon: CheckSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-sidebar-brand">
        <h1>Choosing the Best</h1>
        <p>Sales Dashboard</p>
      </div>
      <nav className="dashboard-sidebar-nav">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`dashboard-sidebar-link${active ? ' is-active' : ''}`}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
