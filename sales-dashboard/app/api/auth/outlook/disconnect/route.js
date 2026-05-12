import { NextResponse } from 'next/server'
import { clearTokens } from '../../../../../lib/graph/tokens'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  await clearTokens(supabase)
  return NextResponse.json({ ok: true })
}
