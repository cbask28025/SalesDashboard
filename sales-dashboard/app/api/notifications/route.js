import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data: notifications } = await supabase
    .from('v2_notifications')
    .select('id, event_type, lead_id, message, created_at, viewed_at')
    .order('created_at', { ascending: false })
    .limit(20)

  const { count: unreadCount } = await supabase
    .from('v2_notifications')
    .select('id', { count: 'exact', head: true })
    .is('viewed_at', null)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  return NextResponse.json({
    ok: true,
    notifications: notifications || [],
    unreadCount: unreadCount || 0,
  })
}

export async function POST(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (body.action === 'mark_all_read') {
    await supabase
      .from('v2_notifications')
      .update({ viewed_at: new Date().toISOString() })
      .is('viewed_at', null)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 })
}
