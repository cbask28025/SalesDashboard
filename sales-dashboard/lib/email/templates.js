// Sequence email templates. Live in code; Cliff edits, Dad does not.
// Merge fields are {first_name}, {district_name}, {state}, {sender_name}.

const SENDER_NAME = process.env.SENDER_NAME || 'Dad'
const COMPANY = 'Choosing the Best'

function renderString(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

const TEMPLATES = {
  email_1: {
    subjectTemplate: 'Quick question about health curriculum at {district_name}',
    bodyTemplate: `<p>Hi {first_name},</p>

<p>I'm reaching out because I think Choosing the Best — a comprehensive K-12 health curriculum used in over 5,000 schools — could be a strong fit for {district_name}.</p>

<p>It covers personal health, mental wellness, substance abuse, and relationships in an evidence-based, classroom-tested format. Most administrators we work with come on board after seeing how well it aligns with state health standards.</p>

<p>Open to a 15-minute call next week to walk you through it?</p>

<p>Best,<br/>
{sender_name}<br/>
${COMPANY}</p>`,
  },
  email_2: {
    subjectTemplate: 'Re: Choosing the Best curriculum for {district_name}',
    bodyTemplate: `<p>Hi {first_name},</p>

<p>Following up — I'd love to share a quick example of how a district similar to {district_name} rolled out our curriculum with strong teacher buy-in and measurable student outcomes.</p>

<p>Happy to send the case study, or to find 15 minutes that work for you.</p>

<p>Best,<br/>
{sender_name}</p>`,
  },
  email_3: {
    subjectTemplate: 'Should I close the loop on {district_name}?',
    bodyTemplate: `<p>Hi {first_name},</p>

<p>I don't want to keep cluttering your inbox. If now's not the right time to look at health curriculum for {district_name}, just let me know and I'll close the file.</p>

<p>If you'd like to reconnect later — or if someone else on your team is the right person — I'd appreciate a quick pointer.</p>

<p>Thanks,<br/>
{sender_name}</p>`,
  },
}

export const SEQUENCE_TEMPLATES = ['email_1', 'email_2', 'email_3']

export function templateForStep(step) {
  return SEQUENCE_TEMPLATES[step] || null
}

export function renderTemplate(templateKey, lead) {
  const t = TEMPLATES[templateKey]
  if (!t) throw new Error(`Unknown template: ${templateKey}`)
  const vars = {
    first_name: lead.first_name || 'there',
    last_name: lead.last_name || '',
    district_name: lead.district_name || 'your district',
    state: lead.state || '',
    sender_name: SENDER_NAME,
  }
  return {
    subject: renderString(t.subjectTemplate, vars),
    htmlBody: renderString(t.bodyTemplate, vars),
  }
}
