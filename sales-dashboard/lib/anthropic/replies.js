import Anthropic from '@anthropic-ai/sdk'

function client() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  return new Anthropic({ apiKey: key })
}

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

const DRAFT_PROMPT = `You draft email replies for a K-12 health curriculum sales rep (Choosing the Best). Voice: warm, professional, concise. No exclamation points. No emojis. Always sign as the rep's first name. Default to short replies under 100 words unless a longer answer is required.

Given the prior email thread + the prospect's reply, draft a response that:
- For positive: confirms interest, suggests a concrete next step (call or send materials), proposes 2 specific times.
- For question: answers the question directly, then offers a next step.
- For negative: thanks them, leaves the door open, offers to circle back later (no pushiness).
- For unsubscribe: confirms removal politely. One sentence.

Return ONLY plain text, no greeting fields, no preamble. Start with "Hi {first_name},".`

export async function classifyReply(replyBody, lead) {
  const c = client()
  if (!c) return { classification: 'question', summary: replyBody.slice(0, 140) }

  try {
    const resp = await c.messages.create({
      model: 'claude-haiku-4-5-20251001',
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

export async function draftReply(replyBody, lead, classification) {
  const c = client()
  const firstName = lead.first_name || 'there'
  if (!c) {
    return `Hi ${firstName},\n\nThanks for getting back to me. (Draft generator is offline — please reply manually.)\n\nBest,\n${process.env.SENDER_NAME || ''}`
  }

  try {
    const resp = await c.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `${DRAFT_PROMPT.replace('{first_name}', firstName)}

Classification: ${classification}
Lead: ${firstName} ${lead.last_name || ''} (${lead.title || 'unknown title'}) at ${lead.district_name || 'unknown district'}

Their reply:
"""
${replyBody}
"""`,
      }],
    })
    return resp.content.find((b) => b.type === 'text')?.text ?? ''
  } catch (err) {
    console.error('Reply draft failed:', err.message)
    return `Hi ${firstName},\n\nThanks for getting back to me. I'll follow up shortly.\n\nBest,\n${process.env.SENDER_NAME || ''}`
  }
}

export async function suggestTaskFromReply(replyBody, lead, classification) {
  // Only positive/question replies yield action-worthy tasks.
  if (classification === 'negative' || classification === 'unsubscribe') return null
  const c = client()
  if (!c) return null

  try {
    const resp = await c.messages.create({
      model: 'claude-haiku-4-5-20251001',
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
