// Tier classification for education job titles.
// Strategy: keyword rules (cheap, deterministic) → Claude API for ambiguous → tier3 default.
// Results cached in v2_settings.title_classifications.

import Anthropic from '@anthropic-ai/sdk'
import { logAiUsage } from './usage'

const MODEL = 'claude-haiku-4-5-20251001'

const TIER_1 = /superintendent|chief|^cao$|^cco$|director of curriculum|director of instruction|director of teaching|curriculum director|health coordinator|wellness coordinator|director of health/i
const TIER_2 = /principal|department head|department chair|lead teacher|assistant principal|coordinator|specialist|administrator|^dean$/i
const TIER_3 = /teacher|counselor|aide|paraprofessional|para[- ]?educator|instructor|tutor|assistant/i

function keywordTier(title) {
  if (!title) return null
  if (TIER_1.test(title)) return 'tier1'
  if (TIER_2.test(title)) return 'tier2'
  if (TIER_3.test(title)) return 'tier3'
  return null
}

async function claudeTier(supabase, titles) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || titles.length === 0) {
    return Object.fromEntries(titles.map((t) => [t, 'tier3']))
  }

  const client = new Anthropic({ apiKey: key })
  const prompt = `You classify K-12 education job titles into three tiers for sales prioritization.

tier1 = decision-makers who control curriculum purchases: Superintendent, Director of Curriculum, Director of Instruction, Health Coordinator, Curriculum Director.
tier2 = influencers who shape curriculum decisions: Principal, Department Head, Lead Teacher, Assistant Principal.
tier3 = end users: Teacher, Counselor, Paraprofessional.

Classify each title. Return ONLY valid JSON with the exact shape:
{"<title>": "tier1|tier2|tier3", ...}

Titles to classify:
${titles.map((t) => `- ${t}`).join('\n')}`

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    await logAiUsage(supabase, { feature: 'title_classify', model: MODEL, usage: resp.usage })
    const text = resp.content.find((b) => b.type === 'text')?.text ?? '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])
    const out = {}
    for (const t of titles) {
      const v = parsed[t]
      out[t] = v === 'tier1' || v === 'tier2' || v === 'tier3' ? v : 'tier3'
    }
    return out
  } catch (err) {
    console.error('Claude title classification failed:', err.message)
    return Object.fromEntries(titles.map((t) => [t, 'tier3']))
  }
}

/**
 * Classify a list of titles. Uses a Supabase-backed cache stored as a JSONB
 * map under v2_settings.title_classifications. Returns { title: tier } for
 * every title passed in.
 */
export async function classifyTitles(supabase, titles) {
  const unique = Array.from(new Set(titles.map((t) => (t || '').trim()).filter(Boolean)))
  if (unique.length === 0) return {}

  const { data: cacheRow } = await supabase
    .from('v2_settings')
    .select('value')
    .eq('key', 'title_classifications')
    .maybeSingle()

  const cache = cacheRow?.value && typeof cacheRow.value === 'object' ? { ...cacheRow.value } : {}

  const result = {}
  const ambiguous = []

  for (const title of unique) {
    if (cache[title]) {
      result[title] = cache[title]
      continue
    }
    const kw = keywordTier(title)
    if (kw) {
      result[title] = kw
      cache[title] = kw
    } else {
      ambiguous.push(title)
    }
  }

  if (ambiguous.length > 0) {
    const aiResults = await claudeTier(supabase, ambiguous)
    for (const [title, tier] of Object.entries(aiResults)) {
      result[title] = tier
      cache[title] = tier
    }
  }

  await supabase
    .from('v2_settings')
    .upsert({ key: 'title_classifications', value: cache }, { onConflict: 'key' })

  return result
}
