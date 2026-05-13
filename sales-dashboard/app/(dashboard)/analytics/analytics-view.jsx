'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, FunnelChart, Funnel, LabelList,
} from 'recharts'
import { fullName, relativeTime, STATUS_LABEL, STATUS_ORDER } from '../../../lib/format'

const STATUS_COLORS = {
  new: '#7A8499',
  sequencing: '#3D5A9C',
  warm: '#D9A047',
  engaged: '#5878B8',
  hot: '#D14D5C',
  demo_scheduled: '#6B5BA8',
  negotiating: '#6B5BA8',
  closed_won: '#4A8C5C',
  not_interested: '#7A8499',
  bounced: '#D14D5C',
}

// Statuses excluded from the pipeline chart (they're tracked in the DB but
// don't represent live pipeline state worth visualizing).
const PIPELINE_CHART_EXCLUDES = new Set(['on_hold', 'unsubscribed', 'closed_lost'])

const EVENT_LABEL = { open: 'Opened', click: 'Clicked', reply: 'Replied', bounce: 'Bounced', unsubscribe: 'Unsubscribed' }
const TEMPLATE_LABEL = { email_1: 'Email 1', email_2: 'Email 2', email_3: 'Email 3', reply: 'Reply' }

export default function AnalyticsView({ stats }) {
  const router = useRouter()
  const params = useSearchParams()

  function setRange(range) {
    const sp = new URLSearchParams(params)
    sp.set('range', range)
    router.push(`/analytics?${sp.toString()}`)
  }

  const sends = stats.totals.sendsInRange || 0
  const uniqueOpens = stats.events.unique?.open || 0
  const uniqueClicks = stats.events.unique?.click || 0
  const uniqueReplies = stats.events.unique?.reply || 0
  const totalOpens = stats.events.totals?.open || 0
  const totalClicks = stats.events.totals?.click || 0
  const totalReplies = stats.events.totals?.reply || 0

  // Rates use unique-by-send counts so they can never exceed 100%.
  const openRate = sends > 0 ? Math.min(100, Math.round((uniqueOpens / sends) * 100)) : 0
  const clickRate = sends > 0 ? Math.min(100, Math.round((uniqueClicks / sends) * 100)) : 0

  // Funnel uses raw totals so engagement intensity is visible.
  const funnelData = [
    { name: 'Sent',    value: sends,        fill: '#3D5A9C' },
    { name: 'Opened',  value: totalOpens,   fill: '#5878B8' },
    { name: 'Clicked', value: totalClicks,  fill: '#D9A047' },
    { name: 'Replied', value: totalReplies, fill: '#D14D5C' },
  ]

  const statusData = STATUS_ORDER
    .filter((s) => !PIPELINE_CHART_EXCLUDES.has(s))
    .map((s) => ({ status: s, label: STATUS_LABEL[s], count: stats.statusBreakdown[s] || 0 }))
    .filter((d) => d.count > 0)

  return (
    <div className="analytics-shell">
      <div className="analytics-range-toggle">
        <button className={stats.range === 'month' ? 'is-active' : ''} onClick={() => setRange('month')}>This month</button>
        <button className={stats.range === 'all' ? 'is-active' : ''} onClick={() => setRange('all')}>All time</button>
      </div>

      <div className="analytics-stat-grid">
        <StatCard label="Total leads" value={stats.totals.leads} />
        <StatCard label="Hot leads" value={stats.totals.hot} />
        <StatCard label={`Emails sent ${stats.range === 'month' ? '(this month)' : '(all time)'}`} value={sends} />
        <StatCard label="Open rate" value={`${openRate}%`} />
        <StatCard label="Click rate" value={`${clickRate}%`} />
        <StatCard label="Replies" value={uniqueReplies} />
      </div>

      <div className="analytics-charts">
        <section className="analytics-card">
          <h3>Engagement funnel</h3>
          <div className="analytics-chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#1F2A44" stroke="none" dataKey="name" />
                  <LabelList position="center" fill="#fff" stroke="none" dataKey="value" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="analytics-card">
          <h3>Pipeline by status</h3>
          {statusData.length === 0 ? (
            <p className="drawer-empty">No active pipeline leads yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusData} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEFF3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7A8499' }} interval={0} angle={-25} height={70} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#7A8499' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count">
                  {statusData.map((d, i) => (
                    <Cell key={i} fill={STATUS_COLORS[d.status] || '#3D5A9C'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      <section className="analytics-card">
        <h3>Recent activity</h3>
        {stats.recentEvents.length === 0 ? (
          <p className="drawer-empty">No events in this range.</p>
        ) : (
          <table className="leads-table">
            <thead>
              <tr><th>Lead</th><th>Action</th><th>Email</th><th>When</th></tr>
            </thead>
            <tbody>
              {stats.recentEvents.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href="/leads">{fullName(e.v2_leads) || e.v2_leads?.email}</Link>
                  </td>
                  <td><span className={`reply-classification is-${e.event_type === 'reply' ? 'positive' : 'question'}`}>{EVENT_LABEL[e.event_type] || e.event_type}</span></td>
                  <td>{TEMPLATE_LABEL[e.v2_email_sends?.email_template] || e.v2_email_sends?.email_template || '—'}</td>
                  <td>{relativeTime(e.occurred_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="analytics-stat">
      <span className="analytics-stat-label">{label}</span>
      <span className="analytics-stat-value">{value}</span>
    </div>
  )
}
