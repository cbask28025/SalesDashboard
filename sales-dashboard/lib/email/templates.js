// Templates now live in v2_email_templates (DB-backed). This module is the
// thin renderer that takes a stored template + a lead and produces a
// subject/htmlBody pair with merge tags substituted.

const SENDER_NAME = process.env.SENDER_NAME || 'Dad'

function renderString(tpl, vars) {
  return (tpl || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

export function buildMergeVars(lead) {
  return {
    first_name: lead?.first_name || 'there',
    last_name: lead?.last_name || '',
    district_name: lead?.district_name || 'your district',
    state: lead?.state || '',
    title: lead?.title || '',
    sender_name: SENDER_NAME,
  }
}

export function renderTemplate(template, lead) {
  if (!template) throw new Error('Template not provided')
  const vars = buildMergeVars(lead)
  return {
    subject: renderString(template.subject_template, vars),
    htmlBody: renderString(template.body_template, vars),
  }
}

/**
 * Load all active templates ordered by position. Caller should treat the
 * 0-indexed position in the returned array as the "step rank" — i.e.
 * templates[0] is Email 1, templates[1] is Email 2.
 */
export async function loadActiveTemplates(supabase) {
  const { data, error } = await supabase
    .from('v2_email_templates')
    .select('*')
    .eq('is_active', true)
    .order('position', { ascending: true })
  if (error) throw new Error(`Failed to load templates: ${error.message}`)
  return data || []
}

export const SAMPLE_LEAD_FOR_PREVIEW = {
  first_name: 'Sarah',
  last_name: 'Johnson',
  district_name: 'Atlanta Public Schools',
  state: 'GA',
  title: 'Curriculum Director',
}
