import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { HANDLERS } from '../../../../lib/anthropic/tool-handlers'
import { WRITE_TOOLS } from '../../../../lib/anthropic/chat-tools'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { tool_use_id, name, input, approved } = body
  if (!tool_use_id || !name) {
    return NextResponse.json({ ok: false, error: 'tool_use_id and name required' }, { status: 400 })
  }

  if (!WRITE_TOOLS.has(name)) {
    return NextResponse.json({ ok: false, error: 'Tool is not a confirmable write tool' }, { status: 400 })
  }

  if (!approved) {
    return NextResponse.json({
      ok: true,
      toolResult: { type: 'tool_result', tool_use_id, content: 'User cancelled this action.' },
    })
  }

  const handler = HANDLERS[name]
  if (!handler) {
    return NextResponse.json({ ok: false, error: `Unknown tool: ${name}` }, { status: 400 })
  }

  try {
    const result = await handler(supabase, input)
    return NextResponse.json({
      ok: true,
      toolResult: { type: 'tool_result', tool_use_id, content: JSON.stringify(result) },
    })
  } catch (err) {
    return NextResponse.json({
      ok: true,
      toolResult: { type: 'tool_result', tool_use_id, is_error: true, content: err.message },
    })
  }
}
