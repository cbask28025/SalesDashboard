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
  Settings: (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
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

  const getStageColor = (stage) => {
    switch(stage) {
      case 'Unsubscribed': return '#ef4444'
      case 'Completed': return '#8b5cf6'
      case 'Initial': return '#3b82f6'
      case 'Follow Up': return '#f59e0b'
      case 'Closing': return '#10b981'
      default: return '#71717a'
    }
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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

      <div className="filters" style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select 
          value={tierFilter} 
          onChange={(e) => setTierFilter(e.target.value)}
          style={{ padding: '8px 12px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', color: 'white' }}
        >
          <option value="all">All Tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', color: 'white' }}
        >
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
        <select 
          value={stageFilter} 
          onChange={(e) => setStageFilter(e.target.value)}
          style={{ padding: '8px 12px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', color: 'white' }}
        >
          <option value="all">All Email Stages</option>
          <option value="Not Started">Not Started</option>
          <option value="Initial">Initial</option>
          <option value="Follow Up">Follow Up</option>
          <option value="Closing">Closing</option>
          <option value="Completed">Completed</option>
          <option value="Unsubscribed">Unsubscribed</option>
        </select>
        <span style={{ marginLeft: '8px', color: '#71717a', alignSelf: 'center' }}>{filtered.length} leads shown</span>
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
                  return (
                    <tr key={lead.id}>
                      <td>
                        <div className="lead-name">{(lead.first_name || '') + ' ' + (lead.last_name || '')}</div>
                      </td>
                      <td style={{ color: lead.unsubscribed_at ? '#ef4444' : '#a1a1aa' }}>
                        {lead.email}
                        {lead.unsubscribed_at && <span style={{ marginLeft: '6px', fontSize: '12px' }}>⛔</span>}
                      </td>
                      <td>
                        {lead.phone ? (
                          <a href={'tel:' + lead.phone} className="phone-link">{lead.phone}</a>
                        ) : <span style={{ color: '#71717a' }}>-</span>}
                      </td>
                      <td>
                        <div>{lead.district_name || '-'}</div>
                        <div className="lead-title">{lead.district_state || ''}</div>
                      </td>
                      <td>
                        <span className={'badge badge-tier' + lead.tier}>Tier {lead.tier}</span>
                      </td>
                      <td>
                        <span className={'badge badge-' + (lead.status === 'hot' ? 'hot' : lead.status === 'warm' ? 'warm' : 'pending')}>{lead.status}</span>
                      </td>
                      <td>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          fontWeight: '500',
                          background: getStageColor(stage) + '20',
                          color: getStageColor(stage)
                        }}>
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
        if (error.code === '23505') {
          skipped++
        } else {
          errors.push(email + ': ' + error.message)
        }
      } else {
        created++
      }
    }

    setResult({ created, skipped, errors })
    setUploading(false)
    if (created > 0 && onRefresh) {
      onRefresh()
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Upload Leads</h2>
        <p>Import a CSV file with your lead list</p>
      </div>

      {result && (
        <div className="card" style={{ background: result.created > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', borderColor: result.created > 0 ? '#10b981' : '#f43f5e' }}>
          <h3 style={{ marginBottom: '8px' }}>Import Complete</h3>
          <p><strong>{result.created}</strong> leads created</p>
          <p><strong>{result.skipped}</strong> skipped (duplicates or missing email)</p>
          {result.errors.length > 0 && (
            <div style={{ marginTop: '8px', color: '#f43f5e' }}>
              <strong>Errors:</strong>
              {result.errors.slice(0, 5).map((e, i) => <p key={i} style={{ fontSize: '13px' }}>{e}</p>)}
            </div>
          )}
          <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => { setResult(null); setFile(null); setPreview(null); }}>
            Upload Another
          </button>
        </div>
      )}

      {!result && (
        <>
          <div
            className="card"
            style={{
              border: dragActive ? '2px dashed #10b981' : '2px dashed #3f3f46',
              background: dragActive ? 'rgba(16,185,129,0.1)' : 'transparent',
              textAlign: 'center',
              padding: '60px 20px',
              cursor: 'pointer'
            }}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            onClick={() => document.getElementById('csv-upload').click()}
          >
            <input type="file" id="csv-upload" accept=".csv" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <p style={{ fontSize: '18px', marginBottom: '8px' }}>Drag & drop your CSV file here</p>
            <p style={{ color: '#71717a' }}>or click to browse</p>
          </div>

          {preview && (
            <div className="card" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <strong>{file.name}</strong>
                  <span className="badge" style={{ marginLeft: '8px' }}>{preview.total} leads</span>
                </div>
                <button className="btn btn-ghost" onClick={() => { setFile(null); setPreview(null); }}>✕</button>
              </div>

              <p style={{ color: '#a1a1aa', marginBottom: '12px' }}>Preview (first 3 rows):</p>
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

          <div className="card" style={{ marginTop: '20px', background: 'rgba(59,130,246,0.1)', borderColor: '#3b82f6' }}>
            <h4 style={{ marginBottom: '8px' }}>Required CSV Columns</h4>
            <p style={{ color: '#a1a1aa' }}><code style={{ color: '#10b981' }}>email</code>, <code style={{ color: '#10b981' }}>first_name</code>, <code style={{ color: '#10b981' }}>last_name</code>, <code style={{ color: '#10b981' }}>title</code>, <code style={{ color: '#10b981' }}>district_name</code></p>
            <p style={{ color: '#71717a', marginTop: '8px' }}>Optional: phone, district_state, school_name</p>
          </div>
        </>
      )}
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

  // Email Sequence Funnel Stats
  const funnel = {
    unsubscribed: leads.filter(l => l.unsubscribed_at).length,
    notStarted: leads.filter(l => !l.unsubscribed_at && (!l.sequence_step || l.sequence_step === 0)).length,
    initial: leads.filter(l => !l.unsubscribed_at && l.sequence_step === 1).length,
    followUp: leads.filter(l => !l.unsubscribed_at && l.sequence_step === 2).length,
    closing: leads.filter(l => !l.unsubscribed_at && l.sequence_step === 3 && !l.sequence_completed_at).length,
    completed: leads.filter(l => !l.unsubscribed_at && l.sequence_completed_at).length
  }

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

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">Email Sequence Funnel</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginTop: '16px' }}>
          <div style={{ textAlign: 'center', padding: '20px', background: '#18181b', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#71717a' }}>{funnel.notStarted}</div>
            <div style={{ fontSize: '12px', color: '#71717a', marginTop: '4px' }}>Not Started</div>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', background: '#18181b', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{funnel.initial}</div>
            <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px' }}>Initial</div>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', background: '#18181b', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{funnel.followUp}</div>
            <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>Follow Up</div>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', background: '#18181b', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{funnel.closing}</div>
            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>Closing</div>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', background: '#18181b', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#8b5cf6' }}>{funnel.completed}</div>
            <div style={{ fontSize: '12px', color: '#8b5cf6', marginTop: '4px' }}>Completed</div>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', background: '#18181b', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>{funnel.unsubscribed}</div>
            <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>Unsubscribed</div>
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

function SettingsTab() {
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    if (!supabase) return
    const { data } = await supabase
      .from('settings')
      .select('*')
      .order('key')
    setSettings(data || [])
    setLoading(false)
  }

  function handleChange(id, newValue) {
    setSettings(settings.map(s => 
      s.id === id ? { ...s, value: newValue } : s
    ))
  }

  async function saveSetting(id, newValue) {
    setSaving(id)
    await supabase
      .from('settings')
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('id', id)
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Configure email sequence timing and thresholds</p>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '20px', color: '#10b981' }}>Email Sequence Timing</h3>
        
        {settings.filter(s => s.key.includes('days_between')).map(setting => (
          <div key={setting.id} style={{ marginBottom: '20px', padding: '15px', background: '#18181b', borderRadius: '8px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              {setting.key === 'days_between_email_1_and_2' ? 'Days between Email 1 and Email 2' : 'Days between Email 2 and Email 3'}
            </label>
            <p style={{ color: '#71717a', fontSize: '14px', marginBottom: '10px' }}>{setting.description}</p>
            <input
              type="number"
              min="1"
              max="30"
              value={setting.value}
              onChange={(e) => handleChange(setting.id, e.target.value)}
              onBlur={(e) => saveSetting(setting.id, e.target.value)}
              style={{ 
                padding: '10px 15px', 
                background: '#27272a', 
                border: '1px solid #3f3f46', 
                borderRadius: '6px', 
                color: 'white',
                width: '100px',
                fontSize: '16px'
              }}
            />
            <span style={{ marginLeft: '10px', color: '#a1a1aa' }}>days</span>
            {saving === setting.id && <span style={{ marginLeft: '10px', color: '#10b981' }}>Saving...</span>}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3 style={{ marginBottom: '20px', color: '#f59e0b' }}>Hot Lead Thresholds</h3>
        
        {settings.filter(s => s.key.includes('hot_threshold')).map(setting => (
          <div key={setting.id} style={{ marginBottom: '20px', padding: '15px', background: '#18181b', borderRadius: '8px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              {setting.key === 'hot_threshold_opens' ? 'Opens to become Hot' : 'Clicks to become Hot'}
            </label>
            <p style={{ color: '#71717a', fontSize: '14px', marginBottom: '10px' }}>{setting.description}</p>
            <input
              type="number"
              min="1"
              max="20"
              value={setting.value}
              onChange={(e) => handleChange(setting.id, e.target.value)}
              onBlur={(e) => saveSetting(setting.id, e.target.value)}
              style={{ 
                padding: '10px 15px', 
                background: '#27272a', 
                border: '1px solid #3f3f46', 
                borderRadius: '6px', 
                color: 'white',
                width: '100px',
                fontSize: '16px'
              }}
            />
            <span style={{ marginLeft: '10px', color: '#a1a1aa' }}>{setting.key.includes('opens') ? 'opens' : 'clicks'}</span>
            {saving === setting.id && <span style={{ marginLeft: '10px', color: '#10b981' }}>Saving...</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
