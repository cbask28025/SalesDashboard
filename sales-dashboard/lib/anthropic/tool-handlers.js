// Tool execution. Each handler returns a JSON-serializable value.
// Read tools run without confirmation; write tools require the client
// to send back a `confirmed: true` flag (enforced in the chat route).

const VALID_STATUSES = new Set([
  'new', 'sequencing', 'engaged', 'hot', 'warm', 'demo_scheduled',
  'negotiating', 'closed_won', 'closed_lost', 'not_interested',
  'unsubscribed', 'bounced', 'on_hold',
])

export async function query_leads(supabase, args = {}) {
  const limit = Math.min(args.limit || 25, 100)
  let q = supabase.from('v2_leads').select('id, email, first_name, last_name, title, district_name, state, tier, status, opens_count, clicks_count, replies_count, last_activity_at').limit(limit)
  if (args.status) q = q.eq('status', args.status)
  if (args.tier) q = q.eq('tier', args.tier)
  if (args.state) q = q.eq('state', args.state.toUpperCase())
  if (args.search) {
    const s = args.search.replace(/[%_]/g, '')
    q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,district_name.ilike.%${s}%`)
  }
  if (args.engagement === 'opened') q = q.gt('opens_count', 0)
  if (args.engagement === 'clicked') q = q.gt('clicks_count', 0)
  if (args.engagement === 'replied') q = q.gt('replies_count', 0)
  if (args.engagement === 'none') q = q.eq('opens_count', 0).eq('clicks_count', 0).eq('replies_count', 0)

  q = q.order('last_activity_at', { ascending: false, nullsFirst: false })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return { count: data.length, leads: data }
}

export async function get_lead(supabase, args = {}) {
  if (!args.email && !args.id) throw new Error('email or id required')
  let q = supabase.from('v2_leads').select('*').limit(1)
  q = args.id ? q.eq('id', args.id) : q.eq('email', args.email.toLowerCase())
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(error.message)
  return data || null
}

export async function get_analytics(supabase, args = {}) {
  const range = args.range === 'all' ? 'all' : 'month'
  const sinceIso = range === 'all'
    ? '1970-01-01T00:00:00Z'
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [{ count: leads }, { count: hot }, { count: sequencing }, sends, events] = await Promise.all([
    supabase.from('v2_leads').select('id', { count: 'exact', head: true }),
    supabase.from('v2_leads').select('id', { count: 'exact', head: true }).eq('status', 'hot'),
    supabase.from('v2_leads').select('id', { count: 'exact', head: true }).eq('status', 'sequencing'),
    supabase.from('v2_email_sends').select('id', { count: 'exact', head: true }).gte('sent_at', sinceIso),
    supabase.from('v2_email_events').select('event_type').gte('occurred_at', sinceIso),
  ])

  const eventCounts = { open: 0, click: 0, reply: 0, bounce: 0, unsubscribe: 0 }
  for (const e of events.data || []) {
    if (eventCounts[e.event_type] !== undefined) eventCounts[e.event_type]++
  }

  return {
    range,
    totals: { leads, hot, sequencing, sends_in_range: sends.count || 0 },
    events: eventCounts,
  }
}

export async function get_summary(supabase) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()

  const [{ count: sentToday }, { count: pendingReplies }, { count: hotLeads }, { data: recentReplies }] = await Promise.all([
    supabase.from('v2_email_sends').select('id', { count: 'exact', head: true }).gte('sent_at', todayIso),
    supabase.from('v2_replies').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('v2_leads').select('id', { count: 'exact', head: true }).eq('status', 'hot'),
    supabase
      .from('v2_replies')
      .select('classification, received_at, v2_leads(first_name, last_name, district_name)')
      .order('received_at', { ascending: false })
      .limit(5),
  ])

  return {
    today: {
      sent: sentToday || 0,
      pending_replies: pendingReplies || 0,
      hot_leads_total: hotLeads || 0,
    },
    recent_replies: (recentReplies || []).map((r) => ({
      classification: r.classification,
      received_at: r.received_at,
      from: `${r.v2_leads?.first_name || ''} ${r.v2_leads?.last_name || ''}`.trim(),
      district: r.v2_leads?.district_name,
    })),
  }
}

export async function update_lead_status(supabase, args = {}) {
  if (!Array.isArray(args.lead_ids) || args.lead_ids.length === 0) throw new Error('lead_ids required')
  if (!VALID_STATUSES.has(args.status)) throw new Error(`Invalid status: ${args.status}`)
  const patch = { status: args.status, last_activity_at: new Date().toISOString() }
  if (args.status === 'unsubscribed') {
    patch.unsubscribed = true
    patch.unsubscribed_at = new Date().toISOString()
  }
  const { error } = await supabase.from('v2_leads').update(patch).in('id', args.lead_ids)
  if (error) throw new Error(error.message)
  return { updated: args.lead_ids.length, status: args.status }
}

export async function pause_sequence(supabase, args = {}) {
  return update_lead_status(supabase, { lead_ids: args.lead_ids, status: 'on_hold' })
}

export async function resume_sequence(supabase, args = {}) {
  return update_lead_status(supabase, { lead_ids: args.lead_ids, status: 'sequencing' })
}

export async function reset_pipeline(supabase, args = {}) {
  if (!Array.isArray(args.lead_ids) || args.lead_ids.length === 0) throw new Error('lead_ids required')
  const { error } = await supabase
    .from('v2_leads')
    .update({
      sequence_step: 0,
      status: 'sequencing',
      last_email_sent: null,
      last_activity_at: new Date().toISOString(),
    })
    .in('id', args.lead_ids)
  if (error) throw new Error(error.message)
  return { reset: args.lead_ids.length }
}

export async function create_task(supabase, args = {}) {
  if (!args.title?.trim()) throw new Error('title required')
  const { data, error } = await supabase
    .from('v2_tasks')
    .insert({
      title: args.title.trim(),
      description: args.description || null,
      due_date: args.due_date || null,
      lead_id: args.lead_id || null,
      status: 'todo',
      source: 'ai_chat',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id, title: data.title }
}

export async function add_note(supabase, args = {}) {
  if (!args.lead_id || !args.body) throw new Error('lead_id and body required')
  const { data, error } = await supabase
    .from('v2_lead_notes')
    .insert({ lead_id: args.lead_id, body: args.body, source: 'manual' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id }
}

export const HANDLERS = {
  query_leads, get_lead, get_analytics, get_summary,
  update_lead_status, pause_sequence, resume_sequence,
  reset_pipeline, create_task, add_note,
}
