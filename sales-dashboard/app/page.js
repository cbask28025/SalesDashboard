'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Icons as simple SVG components
const Icons = {
  Target: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Mail: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  BarChart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  Flame: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  CheckSquare: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></svg>,
  MessageSquare: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Phone: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>,
  Upload: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Calendar: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  TrendingUp: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  ExternalLink: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('analytics')
  const [leads, setLeads] = useState([])
  const [hotLeads, setHotLeads] = useState([])
  const [tasks, setTasks] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Load leads
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      setLeads(leadsData || [])

      // Load hot leads
      const { data: hotData } = await supabase
        .from('hot_leads')
        .select('*')
        .limit(20)
      setHotLeads(hotData || [])

      // Load pending tasks
      const { data: tasksData } = await supabase
        .from('pending_tasks')
        .select('*')
        .limit(20)
      setTasks(tasksData || [])

      // Calculate stats
      const totalLeads = leadsData?.length || 0
      const hotCount = hotData?.length || 0
      const taskCount = tasksData?.length || 0

      // Get email stats
      const { count: emailCount } = await supabase
        .from('email_sends')
        .select('*', { count: 'exact', head: true })

      const { count: openCount } = await supabase
        .from('email_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'open')

      setStats({
        totalLeads,
        hotLeads: hotCount,
        tasksToday: taskCount,
        emailsSent: emailCount || 0,
        openRate: emailCount > 0 ? ((openCount || 0) / emailCount * 100).toFixed(1) : 0
      })
    } catch (error) {
      console.error('Error loading data:', error)
    }
    setLoading(false)
  }

  const tabs = [
    { id: 'analytics', label: 'Analytics', icon: Icons.BarChart },
    { id: 'hot-leads', label: 'Hot Leads', icon: Icons.Flame, badge: hotLeads.length },
    { id: 'tasks', label: 'Task Board', icon: Icons.CheckSquare, badge: tasks.length },
    { id: 'replies', label: 'Recent Replies', icon: Icons.MessageSquare },
    { id: 'calls', label: 'Voice Metrics', icon: Icons.Phone },
    { id: 'imports', label: 'Import History', icon: Icons.History },
  ]

  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="container header-content">
          <div className="logo">
            <div className="logo-icon">
              <Icons.Target />
            </div>
            <div className="logo-text">
              <h1>Sales Dashboard</h1>
              <p>K-12 Health Curriculum</p>
            </div>
          </div>
          <div className="status">
            <span className="status-dot"></span>
            System Running
          </div>
        </div>
      </header>

      <div className="container">
        <div className="layout">
          {/* Sidebar */}
          <aside className="sidebar">
            <nav className="nav">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon />
                    {tab.label}
                    {tab.badge > 0 && <span className="nav-badge">{tab.badge}</span>}
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="main">
            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
              </div>
            ) : (
              <>
                {activeTab === 'analytics' && <AnalyticsTab stats={stats} leads={leads} />}
                {activeTab === 'hot-leads' && <HotLeadsTab leads={hotLeads} />}
                {activeTab === 'tasks' && <TasksTab tasks={tasks} onRefresh={loadData} />}
                {activeTab === 'replies' && <RepliesTab />}
                {activeTab === 'calls' && <CallsTab />}
                {activeTab === 'imports' && <ImportsTab />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function AnalyticsTab({ stats, leads }) {
  const pipelineData = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1
    return acc
  }, {})

  const pipeline = [
    { status: 'hot', label: 'Hot', color: '#f43f5e' },
    { status: 'demo_scheduled', label: 'Demo Scheduled', color: '#8b5cf6' },
    { status: 'warm', label: 'Warm', color: '#f59e0b' },
    { status: 'engaged', label: 'Engaged', color: '#10b981' },
    { status: 'sequencing', label: 'Sequencing', color: '#3b82f6' },
    { status: 'new', label: 'New', color: '#71717a' },
  ]

  const maxCount = Math.max(...pipeline.map(p => pipelineData[p.status] || 0), 1)

  return (
    <div>
      <div className="page-header">
        <h2>Analytics</h2>
        <p>Email performance and pipeline health</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-icon"><Icons.Mail /></span>
          </div>
          <div className="stat-value">{stats?.emailsSent || 0}</div>
          <div className="stat-label">Emails Sent</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-icon"><Icons.Target /></span>
          </div>
          <div className="stat-value">{stats?.openRate || 0}%</div>
          <div className="stat-label">Open Rate</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-icon"><Icons.Users /></span>
          </div>
          <div className="stat-value">{stats?.totalLeads || 0}</div>
          <div className="stat-label">Total Leads</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-icon"><Icons.Flame /></span>
          </div>
          <div className="stat-value">{stats?.hotLeads || 0}</div>
          <div className="stat-label">Hot Leads</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Pipeline Health</h3>
          </div>
          {pipeline.map((p) => (
            <div key={p.status} className="pipeline-item">
              <div className="pipeline-dot" style={{ background: p.color }}></div>
              <span className="pipeline-label">{p.label}</span>
              <span className="pipeline-count">{pipelineData[p.status] || 0}</span>
              <div className="pipeline-bar">
                <div
                  className="pipeline-fill"
                  style={{
                    width: `${((pipelineData[p.status] || 0) / maxCount) * 100}%`,
                    background: p.color
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Stats</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Tasks Pending</span>
              <span style={{ fontWeight: 600 }}>{stats?.tasksToday || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Demos Scheduled</span>
              <span style={{ fontWeight: 600 }}>{pipelineData['demo_scheduled'] || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Tier 1 Leads</span>
              <span style={{ fontWeight: 600 }}>{leads.filter(l => l.tier === 1).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HotLeadsTab({ leads }) {
  const [search, setSearch] = useState('')

  const filtered = leads.filter(lead =>
    (lead.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (lead.district_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Hot Leads</h2>
          <p>Leads who opened 2+ times or clicked</p>
        </div>
        <div className="search-box">
          <Icons.Search />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>District</th>
                <th>Tier</th>
                <th>Engagement</th>
                <th>Last Open</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <Icons.Flame />
                      <h3>No hot leads yet</h3>
                      <p>Leads will appear here when they engage with your emails</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <div className="lead-name">{lead.full_name}</div>
                      <div className="lead-title">{lead.title}</div>
                    </td>
                    <td>
                      <div>{lead.district_name}</div>
                      <div className="lead-title">{lead.district_state}</div>
                    </td>
                    <td>
                      <span className={`badge badge-tier${lead.tier}`}>Tier {lead.tier}</span>
                    </td>
                    <td>
                      <div className="engagement">
                        <span className="engagement-stat opens">
                          <strong>{lead.total_opens}</strong> opens
                        </span>
                        <span className="engagement-stat clicks">
                          <strong>{lead.total_clicks}</strong> clicks
                        </span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {lead.last_open_at ? new Date(lead.last_open_at).toLocaleDateString() : '-'}
                    </td>
                    <td>
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="phone-link">{lead.phone}</a>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function TasksTab({ tasks, onRefresh }) {
  const [filter, setFilter] = useState('all')

  async function completeTask(taskId) {
    await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    onRefresh()
  }

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  return (
    <div>
      <div className="page-header">
        <h2>Task Board</h2>
        <p>Pending tasks in priority order</p>
      </div>

      <div className="filters">
        {['all', 'pending', 'snoozed'].map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Icons.CheckSquare />
            <h3>No tasks</h3>
            <p>You're all caught up!</p>
          </div>
        </div>
      ) : (
        filtered.map((task) => (
          <div key={task.id} className="task-item">
            <div
              className="task-checkbox"
              onClick={() => completeTask(task.id)}
            ></div>
            <div className="task-content">
              <div className="task-title">{task.title}</div>
              <div className="task-meta">
                For: {task.lead_name || 'Unknown'} • Source: {task.source?.replace('_', ' ')}
              </div>
            </div>
            <span className={`badge badge-${task.status}`}>{task.status}</span>
            <div className="task-due">
              <div className="task-due-date">
                {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
              </div>
              {task.due_time && <div className="task-due-time">{task.due_time}</div>}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function RepliesTab() {
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReplies()
  }, [])

  async function loadReplies() {
    const { data } = await supabase
      .from('recent_replies')
      .select('*')
      .limit(20)
    setReplies(data || [])
    setLoading(false)
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div>
      <div className="page-header">
        <h2>Recent Replies</h2>
        <p>Latest replies with AI classification</p>
      </div>

      {replies.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Icons.MessageSquare />
            <h3>No replies yet</h3>
            <p>Replies will appear here when leads respond to your emails</p>
          </div>
        </div>
      ) : (
        replies.map((reply) => (
          <div key={reply.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <strong>{reply.full_name}</strong>
                <span className={`badge badge-${reply.reply_classification?.toLowerCase()}`} style={{ marginLeft: '8px' }}>
                  {reply.reply_classification}
                </span>
                <div className="lead-title">{reply.title} • {reply.district_name}</div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                {new Date(reply.occurred_at).toLocaleDateString()}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>{reply.reply_summary || 'No summary'}</p>
          </div>
        ))
      )}
    </div>
  )
}

function CallsTab() {
  const [calls, setCalls] = useState([])
  const [stats, setStats] = useState({ total: 0, interested: 0, cost: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCalls()
  }, [])

  async function loadCalls() {
    const { data } = await supabase
      .from('call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    const callData = data || []
    setCalls(callData)
    setStats({
      total: callData.length,
      interested: callData.filter(c => c.outcome === 'interested').length,
      cost: callData.reduce((sum, c) => sum + (c.cost_cents || 0), 0) / 100
    })
    setLoading(false)
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div>
      <div className="page-header">
        <h2>Voice Metrics</h2>
        <p>AI call performance and costs</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Calls</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.interested}</div>
          <div className="stat-label">Interested</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${stats.cost.toFixed(2)}</div>
          <div className="stat-label">Total Cost</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total > 0 ? ((stats.interested / stats.total) * 100).toFixed(0) : 0}%</div>
          <div className="stat-label">Success Rate</div>
        </div>
      </div>

      {calls.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Icons.Phone />
            <h3>No calls yet</h3>
            <p>AI call logs will appear here</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Phone</th>
                <th>Duration</th>
                <th>Outcome</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id}>
                  <td>{new Date(call.created_at).toLocaleDateString()}</td>
                  <td>{call.phone_number_called}</td>
                  <td>{call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '-'}</td>
                  <td><span className={`badge badge-${call.outcome === 'interested' ? 'hot' : 'pending'}`}>{call.outcome}</span></td>
                  <td>${((call.cost_cents || 0) / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ImportsTab() {
  const [imports, setImports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadImports()
  }, [])

  async function loadImports() {
    const { data } = await supabase
      .from('import_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20)
    setImports(data || [])
    setLoading(false)
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div>
      <div className="page-header">
        <h2>Import History</h2>
        <p>Log of all CSV uploads</p>
      </div>

      {imports.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Icons.Upload />
            <h3>No imports yet</h3>
            <p>Your CSV import history will appear here</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Date</th>
                <th>Total</th>
                <th>Created</th>
                <th>Status</th>
                <th>Tiers</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp.id}>
                  <td><strong>{imp.filename}</strong></td>
                  <td>{new Date(imp.started_at).toLocaleDateString()}</td>
                  <td>{imp.total_rows}</td>
                  <td style={{ color: 'var(--emerald)' }}>{imp.leads_created}</td>
                  <td><span className={`badge badge-${imp.status === 'completed' ? 'tier2' : 'pending'}`}>{imp.status}</span></td>
                  <td>
                    <span className="badge badge-tier1" style={{ marginRight: '4px' }}>T1: {imp.tier_1_count}</span>
                    <span className="badge badge-tier2" style={{ marginRight: '4px' }}>T2: {imp.tier_2_count}</span>
                    <span className="badge badge-tier3">T3: {imp.tier_3_count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
