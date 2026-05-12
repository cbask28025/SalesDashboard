// PRD §8.1: status upgrades only, never downgrades.
// Returns the new status if an upgrade applies, otherwise null.

const RANK = {
  new: 0,
  sequencing: 1,
  warm: 2,
  engaged: 3,
  hot: 4,
}

const TERMINAL = new Set([
  'closed_won', 'closed_lost', 'not_interested',
  'unsubscribed', 'bounced', 'on_hold',
  'demo_scheduled', 'negotiating',
])

function shouldUpgrade(current, candidate) {
  if (TERMINAL.has(current)) return false
  if (!(candidate in RANK)) return false
  return (RANK[candidate] ?? -1) > (RANK[current] ?? -1)
}

/**
 * After recording an event, compute a status upgrade.
 * @param {object} lead — current lead row
 * @param {{eventType?: string, isReply?: boolean, hotThresholds?: {min_opens:number,min_clicks:number}}} ctx
 */
export function computeUpgrade(lead, ctx = {}) {
  if (ctx.isReply) {
    return shouldUpgrade(lead.status, 'hot') ? 'hot' : null
  }

  // Threshold-based hot promotion takes priority over warm/engaged steps.
  if (ctx.hotThresholds && !lead.unsubscribed) {
    const { min_opens = 1, min_clicks = 1 } = ctx.hotThresholds
    const opens = lead.opens_count || 0
    const clicks = lead.clicks_count || 0
    if (opens >= min_opens && clicks >= min_clicks && shouldUpgrade(lead.status, 'hot')) {
      return 'hot'
    }
  }

  if (ctx.eventType === 'click' && shouldUpgrade(lead.status, 'engaged')) {
    return 'engaged'
  }
  if (ctx.eventType === 'open') {
    if ((lead.opens_count || 0) >= 2 && shouldUpgrade(lead.status, 'engaged')) {
      return 'engaged'
    }
    if (shouldUpgrade(lead.status, 'warm')) {
      return 'warm'
    }
  }
  return null
}
