// Determines whether the current moment is inside the configured sending
// window (timezone-aware), respecting weekdays-only and US federal holidays.

// Static US federal holiday list — approximate, covers 2024–2027.
// In production, use a library like `date-holidays` to compute this dynamically.
const HOLIDAYS = new Set([
  '2024-01-01', '2024-01-15', '2024-02-19', '2024-05-27', '2024-06-19',
  '2024-07-04', '2024-09-02', '2024-10-14', '2024-11-11', '2024-11-28', '2024-12-25',
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26', '2025-06-19',
  '2025-07-04', '2025-09-01', '2025-10-13', '2025-11-11', '2025-11-27', '2025-12-25',
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19',
  '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-06-18',
  '2027-07-05', '2027-09-06', '2027-10-11', '2027-11-11', '2027-11-25', '2027-12-24',
])

function tzParts(date, timezone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    weekday: parts.weekday,
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
  }
}

export function withinSendingWindow(now, rules) {
  const {
    start_hour = 9,
    end_hour = 14,
    weekdays_only = true,
    skip_holidays = true,
    timezone = 'America/New_York',
  } = rules || {}

  const p = tzParts(now, timezone)
  if (weekdays_only && (p.weekday === 'Sat' || p.weekday === 'Sun')) return false
  if (skip_holidays && HOLIDAYS.has(p.isoDate)) return false
  if (p.hour < start_hour || p.hour >= end_hour) return false
  return true
}

export function startOfTzDayUtcIso(now, timezone) {
  const p = tzParts(now, timezone)
  // Compute the UTC instant that corresponds to local midnight that day.
  // We do this by constructing a date at noon-local (safer for DST) then
  // walking back by hours/minutes. Approximation is fine for the day boundary.
  const localNoonStr = `${p.isoDate}T12:00:00`
  const localNoon = new Date(localNoonStr)
  // Difference between local noon (interpreted by host) and target tz noon:
  // We can use the offset trick by formatting a known UTC date.
  const offsetMinutes = (() => {
    const test = new Date()
    const local = new Date(test.toLocaleString('en-US', { timeZone: timezone }))
    return (local.getTime() - test.getTime()) / 60000
  })()
  const tzNoonUtc = localNoon.getTime() - offsetMinutes * 60000
  return new Date(tzNoonUtc - 12 * 60 * 60 * 1000).toISOString()
}
