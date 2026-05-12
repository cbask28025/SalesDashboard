'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Bell, LogOut } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { logout } from '../app/login/actions'

const EVENT_LABEL = {
  click: 'Link clicked',
  reply: 'Reply received',
  hot_lead: 'New hot lead',
  task_suggested: 'New task suggested',
}

export default function Header({ userEmail }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ notifications: [], unreadCount: 0 })
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      if (json.ok) setData({ notifications: json.notifications, unreadCount: json.unreadCount })
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    })
    load()
  }

  function doLogout() {
    startTransition(async () => { await logout() })
  }

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
          {data.unreadCount > 0 && (
            <span className="dashboard-bell-badge">
              {data.unreadCount > 99 ? '99+' : data.unreadCount}
            </span>
          )}
        </button>
        {userEmail && <span className="dashboard-header-user">{userEmail}</span>}
        <button
          type="button"
          className="dashboard-bell"
          aria-label="Sign out"
          onClick={doLogout}
          disabled={isPending}
          title="Sign out"
        >
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </div>
      {open && (
        <div className="dashboard-notifications-panel" role="dialog" onMouseLeave={() => setOpen(false)}>
          <div className="dashboard-notifications-header">
            <strong>Notifications</strong>
            <button onClick={markAllRead}>Mark all read</button>
          </div>
          {data.notifications.length === 0 ? (
            <div className="dashboard-notifications-empty">No notifications yet.</div>
          ) : (
            <ul className="dashboard-notifications-list">
              {data.notifications.map((n) => (
                <li key={n.id} className={!n.viewed_at ? 'is-unread' : ''}>
                  <strong>{EVENT_LABEL[n.event_type] || n.event_type}</strong>
                  <span>{n.message}</span>
                  <time>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </header>
  )
}
