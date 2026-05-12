import { formatDistanceToNow, format as dfFormat } from 'date-fns'

export function relativeTime(value) {
  if (!value) return '—'
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function absoluteTime(value, pattern = 'MMM d, yyyy h:mm a') {
  if (!value) return '—'
  try {
    return dfFormat(new Date(value), pattern)
  } catch {
    return '—'
  }
}

export function fullName(lead) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '(no name)'
}

export const STATUS_LABEL = {
  new: 'New',
  sequencing: 'Sequencing',
  engaged: 'Engaged',
  hot: 'Hot',
  warm: 'Warm',
  demo_scheduled: 'Demo scheduled',
  negotiating: 'Negotiating',
  closed_won: 'Closed won',
  closed_lost: 'Closed lost',
  not_interested: 'Not interested',
  unsubscribed: 'Unsubscribed',
  bounced: 'Bounced',
  on_hold: 'On hold',
}

export const STATUS_ORDER = [
  'new', 'sequencing', 'engaged', 'warm', 'hot',
  'demo_scheduled', 'negotiating', 'closed_won', 'closed_lost',
  'not_interested', 'unsubscribed', 'bounced', 'on_hold',
]

export const TIER_LABEL = { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3' }
