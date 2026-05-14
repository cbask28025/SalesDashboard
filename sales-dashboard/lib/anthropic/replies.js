import { getAnthropicClient } from './auth'
import { logAiUsage } from './usage'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_DOC_CONTEXT_CHARS = 8000

const CLASSIFY_PROMPT = `You classify B2B sales email replies in the K-12 education space.
Return a JSON object with two keys:
- "classification": one of "positive", "negative", "question", "unsubscribe"
- "summary": a 1-sentence summary of what the reply says

Definitions:
- positive: interested, asking for materials, scheduling a call, ready to move forward
- negative: not interested, wrong fit, no budget, polite decline
- question: needs more info before committing, asking specifics about price/timing/features
- unsubscribe: explicit opt-out request ("remove me", "stop emailing", "take me off your list")

Respond with ONLY valid JSON, no markdown.`

// Behavioural rules for the reply drafter. The "who the AI is and how it
// speaks" comes from the user-configurable personality stored in
// v2_settings.assistant_system_prompt and is prepended at runtime.
const DRAFT_BEHAVIOR = `Given the prior email thread + the prospect's reply, draft a response.

STRICT GROUNDING: Only say things you can support directly from the reference materials below or the lead's own message. If the prospect asks something the reference materials don't cover, say so plainly ("I'll need to check on that and follow up") instead of inventing specifics. Do not fabricate numbers, dates, pricing, or product capabilities.

Per classification:
- positive: confirm interest, suggest a concrete next step grounded in what the reference materials describe, propose 2 specific times.
- question: answer ONLY from the reference materials. If the answer isn't there, say so and offer to follow up.
- negative: acknowledge, leave the door open, offer to circle back later. No pushiness.
- unsubscribe: confirm removal politely. One sentence.

FORMATTING — important:
- Start with "Hi {first_name},"
- Return plain text only. No greeting fields, no preamble.
- DO NOT add a closing line, sign-off, signature, "Thanks", "Best", "Best regards", "Sincerely", or a name at the bottom. End at the last substantive sentence. The user will append their own signature.`

async function loadPersonality(supabase) {
  const { data } = await supabase
    .from('v2_settings')
    .select('value')
    .eq('key', 'assistant_system_prompt')
    .maybeSingle()
  return typeof data?.value === 'string' ? data.value.trim() : ''
}

async function loadReferenceDocs(supabase) {
  const { data, error } = await supabase
    .from('v2_ai_documents')
    .select('name, purpose, content')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
  if (error || !data) return ''

  let combined = ''
  for (const doc of data) {
    const block = `## ${doc.name}\n_When to use: ${doc.purpose}_\n\n${doc.content}\n\n`
    if (combined.length + block.length > MAX_DOC_CONTEXT_CHARS) break
    combined += block
  }
  return combined.trim()
}

export async function classifyReply(supabase, replyBody, lead) {
  const c = await getAnthropicClient(supabase)
  if (!c) return { classification: 'question', summary: replyBody.slice(0, 140) }

  try {
    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `${CLASSIFY_PROMPT}

Lead: ${lead.first_name || ''} ${lead.last_name || ''} (${lead.title || 'unknown title'}) at ${lead.district_name || 'unknown district'}

Reply body:
"""
${replyBody}
"""`,
      }],
    })
    await logAiUsage(supabase, { feature: 'reply_classify', model: MODEL, usage: resp.usage })
    const text = resp.content.find((b) => b.type === 'text')?.text ?? '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : {}
    const cls = ['positive', 'negative', 'question', 'unsubscribe'].includes(parsed.classification)
      ? parsed.classification
      : 'question'
    return { classification: cls, summary: parsed.summary || replyBody.slice(0, 140) }
  } catch (err) {
    console.error('Reply classification failed:', err.message)
    return { classification: 'question', summary: replyBody.slice(0, 140) }
  }
}

export async function draftReply(supabase, replyBody, lead, classification) {
  const c = await getAnthropicClient(supabase)
  const firstName = lead.first_name || 'there'
  if (!c) {
    return `Hi ${firstName},\n\n(AI drafter is offline — please write your reply manually.)`
  }

  const [personality, docContext] = await Promise.all([
    loadPersonality(supabase),
    loadReferenceDocs(supabase),
  ])

  const systemPrompt = [
    personality,
    DRAFT_BEHAVIOR.replace('{first_name}', firstName),
    docContext ? `Reference materials (lean on these when relevant; cite specifics rather than making them up):\n\n${docContext}` : '',
  ].filter(Boolean).join('\n\n')

  try {
    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Classification: ${classification}
Lead: ${firstName} ${lead.last_name || ''} (${lead.title || 'unknown title'}) at ${lead.district_name || 'unknown district'}

Their reply:
"""
${replyBody}
"""`,
      }],
    })
    await logAiUsage(supabase, { feature: 'reply_draft', model: MODEL, usage: resp.usage })
    return resp.content.find((b) => b.type === 'text')?.text ?? ''
  } catch (err) {
    console.error('Reply draft failed:', err.message)
    return `Hi ${firstName},\n\nThanks for getting back to me. I'll follow up shortly.`
  }
}

export async function suggestTaskFromReply(supabase, replyBody, lead, classification) {
  // Only positive/question replies yield action-worthy tasks.
  if (classification === 'negative' || classification === 'unsubscribe') return null
  const c = await getAnthropicClient(supabase)
  if (!c) return null

  try {
    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `A sales rep just got this reply from ${lead.first_name || ''} ${lead.last_name || ''} at ${lead.district_name || ''}:

"""
${replyBody}
"""

If the reply implies a concrete follow-up action (e.g. "schedule a call next week", "send pricing by Friday", "demo on Tuesday"), propose ONE task as JSON:
{"title": "Schedule call with X", "description": "Sarah asked for a call next week to walk through pricing", "due_date": "YYYY-MM-DD or null"}

If no specific action is implied, return {"title": null}.

Return JSON only.`,
      }],
    })
    await logAiUsage(supabase, { feature: 'task_suggest', model: MODEL, usage: resp.usage })
    const text = resp.content.find((b) => b.type === 'text')?.text ?? '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : {}
    if (!parsed.title) return null
    return {
      title: parsed.title,
      description: parsed.description || null,
      due_date: parsed.due_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due_date) ? parsed.due_date : null,
    }
  } catch (err) {
    console.error('Task suggestion failed:', err.message)
    return null
  }
}
