// Tool definitions for the assistant.
// READ tools execute immediately. WRITE tools require user confirmation.

export const READ_TOOLS = new Set([
  'query_leads', 'get_analytics', 'get_summary', 'get_lead',
])

export const WRITE_TOOLS = new Set([
  'update_lead_status', 'pause_sequence', 'resume_sequence',
  'reset_pipeline', 'create_task', 'add_note',
])

export const TOOL_DEFINITIONS = [
  {
    name: 'query_leads',
    description: 'Search and filter leads in the pipeline. Returns up to 25 matching leads.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: new, sequencing, warm, engaged, hot, demo_scheduled, negotiating, closed_won, closed_lost, not_interested, on_hold' },
        tier: { type: 'string', enum: ['tier1', 'tier2', 'tier3'] },
        state: { type: 'string', description: 'Two-letter US state abbreviation' },
        engagement: { type: 'string', enum: ['opened', 'clicked', 'replied', 'none'] },
        search: { type: 'string', description: 'Free-text search across name/email/district' },
        limit: { type: 'number', description: 'Max rows (default 25, hard cap 100)' },
      },
    },
  },
  {
    name: 'get_lead',
    description: 'Fetch the full record for a specific lead by email or id.',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        id: { type: 'string' },
      },
    },
  },
  {
    name: 'get_analytics',
    description: 'Return pipeline-level stats: lead counts, send/open/click/reply counts, status breakdown.',
    input_schema: {
      type: 'object',
      properties: {
        range: { type: 'string', enum: ['month', 'all'], description: 'Time range. Default month.' },
      },
    },
  },
  {
    name: 'get_summary',
    description: 'Return a brief daily summary: today\'s sends, recent replies, hot leads with new activity.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'update_lead_status',
    description: 'Change the status of one or more leads. Requires confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        lead_ids: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['new','sequencing','engaged','hot','warm','demo_scheduled','negotiating','closed_won','closed_lost','not_interested','unsubscribed','bounced','on_hold'] },
      },
      required: ['lead_ids', 'status'],
    },
  },
  {
    name: 'pause_sequence',
    description: 'Pause the email sequence for one or more leads (sets status to on_hold).',
    input_schema: {
      type: 'object',
      properties: { lead_ids: { type: 'array', items: { type: 'string' } } },
      required: ['lead_ids'],
    },
  },
  {
    name: 'resume_sequence',
    description: 'Resume the email sequence for one or more leads (sets status back to sequencing).',
    input_schema: {
      type: 'object',
      properties: { lead_ids: { type: 'array', items: { type: 'string' } } },
      required: ['lead_ids'],
    },
  },
  {
    name: 'reset_pipeline',
    description: 'Reset one or more leads back to sequence step 0 so they re-enter Email 1.',
    input_schema: {
      type: 'object',
      properties: { lead_ids: { type: 'array', items: { type: 'string' } } },
      required: ['lead_ids'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task in the Task Board. Use status=todo by default.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        lead_id: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_note',
    description: 'Add a note to a lead.',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['lead_id', 'body'],
    },
  },
]
