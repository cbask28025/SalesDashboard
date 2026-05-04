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
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
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
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      setLeads(leadsData || [])

      const { data: hotData } = await supabase
        .from('hot_leads')
        .select('*')
        .limit(20)
      setHotLeads(hotData || [])

      const { data: tasksData } = await supabase
        .from('pending_tasks')
        .select('*')
        .limit(20)
      setTasks(tasksData || [])

      const totalLeads = leadsData?.length || 0
      const hotCount = hotData?.length || 0
      const taskCount = tasksData?.length || 0

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
    { id: 'upload', label: 'Upload', icon: Icons.Upload },
    { id: 'analytics', label: 'Analytics', icon: Icons.BarChart },
    { id: 'all-leads', label: 'All Leads', icon: Icons.Users },
    { id: 'hot-leads', label: 'Hot Leads', icon: Icons.Flame, badge: hotLeads.length },
    { id: 'tasks', label: 'Task Board', icon: Icons.CheckSquare, badge: tasks.length },
    { id: 'replies', label: 'Recent Replies', icon: Icons.MessageSquare },
    { id: 'calls', label: 'Voice Metrics', icon: Icons.Phone },
    { id: 'imports', label: 'Import History', icon: Icons.History },
    { id: 'settings', label: 'Settings', icon: Icons.Settings },
  ]

  return (
    <div>
      <header className="header">
        <div className="container header-content">
          <div className="logo">
            <div className="logo-icon">
              <Icons.Target />
            </div>
            <div className="logo-text">
              <h1>Choosing <em style={{ fontStyle: 'italic' }}>the</em> Best — Sales</h1>
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

          <main className="main">
            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
              </div>
            ) : (
              <>
                {activeTab === 'upload' && <UploadTab onRefresh={loadData} />}
                {activeTab === 'analytics' && <AnalyticsTab stats={stats} leads={leads} />}
                {activeTab === 'all-leads' && <AllLeadsTab leads={leads} onRefresh={loadData} />}
                {activeTab === 'hot-leads' && <HotLeadsTab leads={hotLeads} />}
                {activeTab === 'tasks' && <TasksTab tasks={tasks} onRefresh={loadData} />}
                {activeTab === 'replies' && <RepliesTab />}
                {activeTab === 'calls' && <CallsTab />}
                {activeTab === 'imports' && <ImportsTab />}
                {activeTab === 'settings' && <SettingsTab />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

// ===========================================================
// ALL LEADS
// ===========================================================
function AllLeadsTab({ leads, onRefresh }) {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')

  const getEmailStage = (lead) => {
    if (lead.unsubscribed_at) return 'Unsubscribed'
    if (lead.sequence_completed_at) return 'Completed'
    switch(lead.sequence_step) {
      case 0: return 'Not Started'
      case 1: return 'Initial'
      case 2: return 'Follow Up'
      case 3: return 'Closing'
      default: return 'Not Started'
    }
  }

  // Each stage maps to a CSS variable so colors stay consistent with the theme
  const stageStyles = {
    'Unsubscribed':  { bg: 'var(--status-hot-bg)',     color: 'var(--status-hot)' },
    'Completed':     { bg: 'var(--status-purple-bg)',  color: 'var(--status-purple)' },
    'Initial':       { bg: 'var(--status-cool-bg)',    color: 'var(--status-cool)' },
    'Follow Up':     { bg: 'var(--status-warm-bg)',    color: 'var(--status-warm)' },
    'Closing':       { bg: 'var(--status-success-bg)', color: 'var(--status-success)' },
    'Not Started':   { bg: 'var(--status-neutral-bg)', color: 'var(--status-neutral)' },
  }

  const filtered = leads.filter(lead => {
    const matchesSearch =
      ((lead.first_name || '') + ' ' + (lead.last_name || '')).toLowerCase().includes(search.toLowerCase()) ||
      (lead.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (lead.district_name || '').toLowerCase().includes(search.toLowerCase())
    const matchesTier = tierFilter === 'all' || lead.tier === parseInt(tierFilter)
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
    const matchesStage = stageFilter === 'all' || getEmailStage(lead) === stageFilter
    return matchesSearch && matchesTier && matchesStatus && matchesStage
  })

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h2>All Leads</h2>
          <p>{leads.length} total leads</p>
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

      <div className="filters">
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
          <option value="all">All Tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="sequencing">Sequencing</option>
          <option value="engaged">Engaged</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="demo_scheduled">Demo Scheduled</option>
          <option value="closed_won">Closed Won</option>
          <option value="closed_lost">Closed Lost</option>
          <option value="not_interested">Not Interested</option>
        </select>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="all">All Email Stages</option>
          <option value="Not Started">Not Started</option>
          <option value="Initial">Initial</option>
          <option value="Follow Up">Follow Up</option>
          <option value="Closing">Closing</option>
          <option value="Completed">Completed</option>
          <option value="Unsubscribed">Unsubscribed</option>
        </select>
        <span style={{ marginLeft: '8px', color: 'var(--text-muted)', alignSelf: 'center' }}>
          {filtered.length} leads shown
        </span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>District</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Email Stage</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state">
                      <Icons.Users />
                      <h3>No leads found</h3>
                      <p>Try adjusting your filters or upload some leads</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => {
                  const stage = getEmailStage(lead)
                  const style = stageStyles[stage]
                  return (
                    <tr key={lead.id}>
                      <td>
                        <div className="lead-name">
                          {(lead.first_name || '') + ' ' + (lead.last_name || '')}
                        </div>
                      </td>
                      <td style={{ color: lead.unsubscribed_at ? 'var(--status-hot)' : 'var(--text-secondary)' }}>
                        {lead.email}
                        {lead.unsubscribed_at && <span style={{ marginLeft: '6px', fontSize: '12px' }}>⛔</span>}
                      </td>
                      <td>
                        {lead.phone
                          ? <a href={'tel:' + lead.phone} className="phone-link">{lead.phone}</a>
                          : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                      </td>
                      <td>
                        <div>{lead.district_name || '-'}</div>
                        <div className="lead-title">{lead.district_state || ''}</div>
                      </td>
                      <td>
                        <span className={'badge badge-tier' + lead.tier}>Tier {lead.tier}</span>
                      </td>
                      <td>
                        <span className={'badge badge-' + (lead.status === 'hot' ? 'hot' : lead.status === 'warm' ? 'warm' : 'pending')}>
                          {lead.status}
                        </span>
                      </td>
                      <td>
                        <span className="stage-chip" style={{ background: style.bg, color: style.color }}>
                          {stage}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ===========================================================
// UPLOAD
// ===========================================================
function UploadTab({ onRefresh }) {
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)

  function parseCSV(text) {
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''))
      const row = {}
      headers.forEach((h, idx) => {
        row[h] = values[idx] || ''
      })
      rows.push(row)
    }
    return rows
  }

  function classifyTier(title) {
    const t = (title || '').toLowerCase()
    if (t.includes('superintendent') || t.includes('director') || t.includes('principal')) return 1
    if (t.includes('coordinator') || t.includes('specialist') || t.includes('coach') || t.includes('manager')) return 2
    return 3
  }

  async function handleFile(f) {
    if (!f.name.endsWith('.csv')) {
      alert('Please upload a CSV file')
      return
    }
    setFile(f)
    const text = await f.text()
    const rows = parseCSV(text)
    setPreview({ total: rows.length, sample: rows.slice(0, 3), rows })
  }

  async function handleUpload() {
    if (!preview) return
    setUploading(true)
    setResult(null)
    let created = 0
    let skipped = 0
    let errors = []

    for (const row of preview.rows) {
      const email = row.email || row.email_address || row.e_mail
      if (!email) {
        skipped++
        continue
      }
      const lead = {
        email: email.toLowerCase(),
        first_name: row.first_name || row.firstname || row.first || '',
        last_name: row.last_name || row.lastname || row.last || '',
        title: row.title || row.job_title || row.position || '',
        phone: row.phone || row.phone_number || row.telephone || '',
        district_name: row.district_name || row.district || row.organization || row.school_district || '',
        district_state: row.district_state || row.state || '',
        school_name: row.school_name || row.school || '',
        tier: classifyTier(row.title || row.job_title || ''),
        status: 'new',
        source: file.name
      }
      const { error } = await supabase.from('leads').insert([lead])
      if (error) {
        if (error.code === '23505') skipped++
        else errors.push(email + ': ' + error.message)
      } else {
        created++
      }
    }
    setResult({ created, skipped, errors })
    setUploading(false)
    if (created > 0 && onRefresh) onRefresh()
  }

  return (
    <div>
      <div className="page-header">
        <h2>Upload Leads</h2>
        <p>Import a CSV file with your lead list</p>
      </div>

      {result && (
        <div className={'alert ' + (result.created > 0 ? 'alert-success' : 'alert-error')}>
          <h3>Import Complete</h3>
          <p><strong>{result.created}</strong> leads created</p>
          <p><strong>{result.skipped}</strong> skipped (duplicates or missing email)</p>
          {result.errors.length > 0 && (
            <div style={{ marginTop: '8px', color: 'var(--status-hot)' }}>
              <strong>Errors:</strong>
              {result.errors.slice(0, 5).map((e, i) => <p key={i} style={{ fontSize: '13px' }}>{e}</p>)}
            </div>
          )}
          <button className="btn btn-secondary mt-20" onClick={() => { setResult(null); setFile(null); setPreview(null); }}>
            Upload Another
          </button>
        </div>
      )}

      {!result && (
        <>
          <div
            className={'upload-zone ' + (dragActive ? 'drag-active' : '')}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            onClick={() => document.getElementById('csv-upload').click()}
          >
            <input type="file" id="csv-upload" accept=".csv" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            <div className="upload-icon">📄</div>
            <p>Drag & drop your CSV file here</p>
            <p>or click to browse</p>
          </div>

          {preview && (
            <div className="card mt-20">
              <div className="flex-between mb-16" style={{ alignItems: 'center' }}>
                <div>
                  <strong>{file.name}</strong>
                  <span className="badge" style={{ marginLeft: '8px' }}>{preview.total} leads</span>
                </div>
                <button className="btn btn-ghost" onClick={() => { setFile(null); setPreview(null); }}>✕</button>
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>Preview (first 3 rows):</p>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Title</th>
                      <th>District</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row, i) => (
                      <tr key={i}>
                        <td>{row.email || row.email_address || '-'}</td>
                        <td>{(row.first_name || row.firstname || '') + ' ' + (row.last_name || row.lastname || '')}</td>
                        <td>{row.title || row.job_title || '-'}</td>
                        <td>{row.district_name || row.district || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Importing...' : `Import ${preview.total} Leads`}
                </button>
                <button className="btn btn-secondary" onClick={() => { setFile(null); setPreview(null); }}>Cancel</button>
              </div>
            </div>
          )}

          <div className="alert alert-info mt-20">
            <h4>Required CSV Columns</h4>
            <p style={{ color: 'var(--text-secondary)' }}>
              <code>email</code>, <code>first_name</code>, <code>last_name</code>, <code>title</code>, <code>district_name</code>
            </p>
            <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '13px' }}>
              Optional: phone, district_state, school_name
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ===========================================================
// ANALYTICS
// ===========================================================
function AnalyticsTab({ stats, leads }) {
  const pipelineData = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1
    return acc
  }, {})

  const pipeline = [
    { status: 'hot',             label: 'Hot',             color: 'var(--status-hot)' },
    { status: 'demo_scheduled',  label: 'Demo Scheduled',  color: 'var(--status-purple)' },
    { status: 'warm',            label: 'Warm',            color: 'var(--status-warm)' },
    { status: 'engaged',         label: 'Engaged',         color: 'var(--status-success)' },
    { status: 'sequencing',      label: 'Sequencing',      color: 'var(--ctb-blue)' },
    { status: 'new',             label: 'New',             color: 'var(--status-neutral)' },
  ]
  const maxCount = Math.max(...pipeline.map(p => pipelineData[p.status] || 0), 1)

  const funnel = {
    unsubscribed: leads.filter(l => l.unsubscribed_at).length,
    notStarted: leads.filter(l => !l.unsubscribed_at && (!l.sequence_step || l.sequence_step === 0)).length,
    initial: leads.filter(l => !l.unsubscribed_at && l.sequence_step === 1).length,
    followUp: leads.filter(l => !l.unsubscribed_at && l.sequence_step === 2).length,
    closing: leads.filter(l => !l.unsubscribed_at && l.sequence_step === 3 && !l.sequence_completed_at).length,
    completed: leads.filter(l => !l.unsubscribed_at && l.sequence_completed_at).length
  }

  const funnelCells = [
    { value: funnel.notStarted,   label: 'Not Started',  color: 'var(--status-neutral)' },
    { value: funnel.initial,      label: 'Initial',      color: 'var(--ctb-blue)' },
    { value: funnel.followUp,     label: 'Follow Up',    color: 'var(--status-warm)' },
    { value: funnel.closing,      label: 'Closing',      color: 'var(--status-success)' },
    { value: funnel.completed,    label: 'Completed',    color: 'var(--status-purple)' },
    { value: funnel.unsubscribed, label: 'Unsubscribed', color: 'var(--status-hot)' },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>Analytics</h2>
        <p>Email performance and pipeline health</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header"><span className="stat-icon"><Icons.Mail /></span></div>
          <div className="stat-value">{stats?.emailsSent || 0}</div>
          <div className="stat-label">Emails Sent</div>
        </div>
        <div className="stat-card">
          <div className="stat-header"><span className="stat-icon"><Icons.Target /></span></div>
          <div className="stat-value">{stats?.openRate || 0}%</div>
          <div className="stat-label">Open Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-header"><span className="stat-icon"><Icons.Users /></span></div>
          <div className="stat-value">{stats?.totalLeads || 0}</div>
          <div className="stat-label">Total Leads</div>
        </div>
        <div className="stat-card">
          <div className="stat-header"><span className="stat-icon"><Icons.Flame /></span></div>
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
          <div>
            <div className="quick-stat-row">
              <span className="label">Tasks Pending</span>
              <span className="value">{stats?.tasksToday || 0}</span>
            </div>
            <div className="quick-stat-row">
              <span className="label">Demos Scheduled</span>
              <span className="value">{pipelineData['demo_scheduled'] || 0}</span>
            </div>
            <div className="quick-stat-row">
              <span className="label">Tier 1 Leads</span>
              <span className="value">{leads.filter(l => l.tier === 1).length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-20">
        <div className="card-header">
          <h3 className="card-title">Email Sequence Funnel</h3>
        </div>
        <div className="funnel-grid">
          {funnelCells.map((c) => (
            <div key={c.label} className="funnel-cell">
              <div className="funnel-value" style={{ color: c.color }}>{c.value}</div>
              <div className="funnel-label" style={{ color: c.color }}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ===========================================================
// HOT LEADS
// ===========================================================
function HotLeadsTab({ leads }) {
  const [search, setSearch] = useState('')

  const filtered = leads.filter(lead =>
    (lead.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (lead.district_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header flex-between">
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

// ===========================================================
// TASKS
// ===========================================================
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
            <div className="task-checkbox" onClick={() => completeTask(task.id)}></div>
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

// ===========================================================
// REPLIES
// ===========================================================
function RepliesTab() {
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadReplies() }, [])

  async function loadReplies() {
    const { data } = await supabase.from('recent_replies').select('*').limit(20)
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
            <div className="flex-between mb-16">
              <div>
                <strong>{reply.full_name}</strong>
                <span className={`badge badge-${reply.reply_classification?.toLowerCase()}`} style={{ marginLeft: '8px' }}>
                  {reply.reply_classification}
                </span>
                <div className="lead-title">{reply.title} • {reply.district_name}</div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
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

// ===========================================================
// CALLS
// ===========================================================
function CallsTab() {
  const [calls, setCalls] = useState([])
  const [stats, setStats] = useState({ total: 0, interested: 0, cost: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadCalls() }, [])

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

// ===========================================================
// IMPORTS
// ===========================================================
function ImportsTab() {
  const [imports, setImports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadImports() }, [])

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
                  <td style={{ color: 'var(--status-success)' }}>{imp.leads_created}</td>
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

// ===========================================================
// SETTINGS
// ===========================================================
function SettingsTab() {
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [originalSettings, setOriginalSettings] = useState([])

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    if (!supabase) return
    const { data } = await supabase.from('settings').select('*').order('key')
    setSettings(data || [])
    setOriginalSettings(JSON.parse(JSON.stringify(data || [])))
    setLoading(false)
  }

  function handleChange(id, newValue) {
    const updated = settings.map(s => s.id === id ? { ...s, value: newValue } : s)
    setSettings(updated)
    // Compare against originals to know if there are unsaved changes
    const hasChanges = updated.some(s => {
      const orig = originalSettings.find(o => o.id === s.id)
      return orig && String(orig.value) !== String(s.value)
    })
    setDirty(hasChanges)
  }

  async function saveAll() {
    setSaving(true)
    const changedSettings = settings.filter(s => {
      const orig = originalSettings.find(o => o.id === s.id)
      return orig && String(orig.value) !== String(s.value)
    })

    for (const s of changedSettings) {
      await supabase
        .from('settings')
        .update({ value: s.value, updated_at: new Date().toISOString() })
        .eq('id', s.id)
    }

    // Reset baseline so dirty flag clears
    setOriginalSettings(JSON.parse(JSON.stringify(settings)))
    setDirty(false)
    setSaving(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2500)
  }

  function discardChanges() {
    setSettings(JSON.parse(JSON.stringify(originalSettings)))
    setDirty(false)
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h2>Settings</h2>
          <p>Configure email sequence timing and thresholds</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {savedFlash && (
            <span style={{
              color: 'var(--status-success)',
              fontWeight: 600,
              fontSize: '13px',
              padding: '6px 12px',
              background: 'var(--status-success-bg)',
              borderRadius: '6px'
            }}>
              ✓ Saved
            </span>
          )}
          {dirty && !saving && (
            <button className="btn btn-secondary" onClick={discardChanges}>
              Discard
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={saveAll}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving...' : dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {dirty && (
        <div className="alert alert-info mb-16">
          <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            You have unsaved changes. Click <strong>Save Changes</strong> to apply them.
          </p>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Email Sequence Timing</h3>
        </div>
        {settings.filter(s => s.key.includes('days_between')).map(setting => (
          <div key={setting.id} className="setting-row">
            <label>
              {setting.key === 'days_between_email_1_and_2' ? 'Days between Email 1 and Email 2' : 'Days between Email 2 and Email 3'}
            </label>
            <p className="desc">{setting.description}</p>
            <input
              type="number"
              min="1"
              max="30"
              value={setting.value}
              onChange={(e) => handleChange(setting.id, e.target.value)}
            />
            <span className="unit">days</span>
          </div>
        ))}
      </div>

      <div className="card mt-20">
        <div className="card-header">
          <h3 className="card-title">Hot Lead Thresholds</h3>
        </div>
        {settings.filter(s => s.key.includes('hot_threshold')).map(setting => (
          <div key={setting.id} className="setting-row">
            <label>
              {setting.key === 'hot_threshold_opens' ? 'Opens to become Hot' : 'Clicks to become Hot'}
            </label>
            <p className="desc">{setting.description}</p>
            <input
              type="number"
              min="1"
              max="20"
              value={setting.value}
              onChange={(e) => handleChange(setting.id, e.target.value)}
            />
            <span className="unit">{setting.key.includes('opens') ? 'opens' : 'clicks'}</span>
          </div>
        ))}
      </div>

      {/* Sticky footer save bar — visible only when there are unsaved changes */}
      {dirty && (
        <div style={{
          position: 'sticky',
          bottom: '20px',
          marginTop: '24px',
          background: 'var(--bg-card)',
          border: '1px solid var(--ctb-blue)',
          borderRadius: '8px',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            Unsaved changes
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={discardChanges}>
              Discard
            </button>
            <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
