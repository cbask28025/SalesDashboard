'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'

export default function Header({ userEmail }) {
  const [open, setOpen] = useState(false)
  // Notification dropdown is a stub in Phase A — wiring up in Phase F.

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-spacer" />
      <div className="dashboard-header-actions">
        <button
          type="button"
          className="dashboard-bell"
          aria-label="Notifications"
          onClick={() => setOpen((v) => !v)}
        >
          <Bell size={18} strokeWidth={1.75} />
        </button>
        {userEmail && <span className="dashboard-header-user">{userEmail}</span>}
      </div>
      {open && (
        <div className="dashboard-notifications-panel" role="dialog">
          <div className="dashboard-notifications-header">
            <strong>Notifications</strong>
          </div>
          <div className="dashboard-notifications-empty">
            No notifications yet.
          </div>
        </div>
      )}
    </header>
  )
}
