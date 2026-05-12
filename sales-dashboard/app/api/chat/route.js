import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '../../../lib/supabase/server'
import { TOOL_DEFINITIONS, READ_TOOLS, WRITE_TOOLS } from '../../../lib/anthropic/chat-tools'
import { HANDLERS } from '../../../lib/anthropic/tool-handlers'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SYSTEM_PROMPT_KEY = 'assistant_system_prompt'
const HISTORY_HOURS = 24

function client() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  return new Anthropic({ apiKey: key })
}

async function loadSystemPrompt(supabase) {
  const { data } = await supabase
    .from('v2_settings')
    .select('value')
    .eq('key', SYSTEM_PROMPT_KEY)
    .maybeSingle()
  return typeof data?.value === 'string'
    ? data.value
    : 'You are a professional, concise sales assistant for Choosing the Best (CTB), a K-12 health curriculum company. Always cite specific numbers and lead names rather than vague answers.'
}

async function loadHistory(supabase, sessionId) {
  const sinceIso = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('v2_assistant_conversations')
    .select('role, content, tool_calls, created_at')
    .eq('session_id', sessionId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
    .limit(60)

  return (data || []).map((row) => {
    if (row.tool_calls?.blocks) {
      return { role: row.role, content: row.tool_calls.blocks }
    }
    return { role: row.role, content: row.content }
  })
}

async function appendHistory(supabase, sessionId, role, content, toolCalls) {
  await supabase.from('v2_assistant_conversations').insert({
    session_id: sessionId,
    role,
    content: typeof content === 'string' ? content : JSON.stringify(content).slice(0, 8000),
    tool_calls: toolCalls || null,
  })
}

function summarizeArgs(name, input) {
  if (input?.lead_ids) {
    const n = Array.isArray(input.lead_ids) ? input.lead_ids.length : 0
    return `${name} on ${n} lead${n === 1 ? '' : 's'}` + (input.status ? ` → ${input.status}` : '')
  }
  if (input?.title) return `${name}: "${input.title}"`
  return name
}

export async function POST(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const c = client()
  if (!c) return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const sessionId = body.sessionId
  if (!sessionId) return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 })

  const systemPrompt = await loadSystemPrompt(supabase)
  let history = await loadHistory(supabase, sessionId)

  // Two modes:
  //  1) user message  → call Claude, return text or tool_use blocks
  //  2) tool confirmations → execute tools, return tool_results to Claude, return text
  if (body.userMessage) {
    history = [...history, { role: 'user', content: body.userMessage }]
    await appendHistory(supabase, sessionId, 'user', body.userMessage)
  } else if (Array.isArray(body.toolResults)) {
    // The previous turn's assistant message (with tool_use blocks) is already in history.
    history = [...history, { role: 'user', content: body.toolResults }]
    await appendHistory(supabase, sessionId, 'user', '[tool results]', { blocks: body.toolResults })
  } else {
    return NextResponse.json({ ok: false, error: 'userMessage or toolResults required' }, { status: 400 })
  }

  const resp = await c.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    tools: TOOL_DEFINITIONS,
    messages: history,
  })

  await appendHistory(supabase, sessionId, 'assistant', '[mixed]', { blocks: resp.content })

  // Sort blocks into text + tool_use; mark which tool_uses need confirmation.
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
  const toolUses = resp.content.filter((b) => b.type === 'tool_use')

  // Auto-execute read tools immediately, return write tools for confirmation.
  const autoResults = []
  const pendingConfirmations = []

  for (const tu of toolUses) {
    if (READ_TOOLS.has(tu.name)) {
      try {
        const handler = HANDLERS[tu.name]
        const result = await handler(supabase, tu.input)
        autoResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) })
      } catch (err) {
        autoResults.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: err.message })
      }
    } else if (WRITE_TOOLS.has(tu.name)) {
      pendingConfirmations.push({
        tool_use_id: tu.id,
        name: tu.name,
        input: tu.input,
        summary: summarizeArgs(tu.name, tu.input),
      })
    }
  }

  if (pendingConfirmations.length > 0) {
    return NextResponse.json({
      ok: true,
      stopReason: resp.stop_reason,
      text,
      pendingConfirmations,
      autoResults, // Client will resend after confirming.
    })
  }

  if (autoResults.length > 0) {
    // Second-round call to let Claude consume the read-tool results.
    const followup = await c.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOL_DEFINITIONS,
      messages: [...history, { role: 'assistant', content: resp.content }, { role: 'user', content: autoResults }],
    })
    await appendHistory(supabase, sessionId, 'user', '[tool results]', { blocks: autoResults })
    await appendHistory(supabase, sessionId, 'assistant', '[final]', { blocks: followup.content })
    const finalText = followup.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
    return NextResponse.json({ ok: true, text: finalText || text, stopReason: followup.stop_reason })
  }

  return NextResponse.json({ ok: true, text, stopReason: resp.stop_reason })
}
