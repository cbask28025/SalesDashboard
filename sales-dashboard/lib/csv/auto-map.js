// Content-based CSV column mapping for v2 leads.
// Each detector scores a column (header + sample values) for a target field.
// We then greedy-assign best column → field, no double assignment.

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
])

const TITLE_KEYWORDS = /superintendent|director|principal|teacher|coordinator|coach|counselor|specialist|administrator|chair|manager|head/i
const DISTRICT_KEYWORDS = /district|school|academy|isd|usd|public schools|county schools/i

const HEADER_HINTS = {
  email: /^e[-_]?mail$|email[-_]?address/i,
  first_name: /first[-_ ]?name|^f[-_]?name$|^first$/i,
  last_name: /last[-_ ]?name|^l[-_]?name$|^last$|surname|family[-_ ]?name/i,
  phone: /^phone|telephone|^tel$|mobile|cell/i,
  title: /^title$|job[-_ ]?title|position|^role$|^job$/i,
  district_name: /district|organization|^org$|school[-_ ]?name|school[-_ ]?district/i,
  state: /^state$|st[-_ ]?abbr|state[-_ ]?code/i,
}

const PATTERN_DETECTORS = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  phone: (v) => {
    const digits = v.replace(/\D/g, '')
    return digits.length >= 10 && digits.length <= 15
  },
  state: (v) => US_STATES.has(v.trim().toUpperCase()),
  title: (v) => TITLE_KEYWORDS.test(v),
  district_name: (v) => DISTRICT_KEYWORDS.test(v),
  first_name: (v) => /^[A-Z][a-zA-Z'’-]{1,30}$/.test(v.trim()),
  last_name: (v) => /^[A-Z][a-zA-Z'’-]{1,30}( [A-Z][a-zA-Z'’-]+)?$/.test(v.trim()),
}

// Weight the header hint vs. the value pattern signal per-field.
const HEADER_WEIGHT = {
  email: 0.35, first_name: 0.7, last_name: 0.7, phone: 0.45,
  title: 0.55, district_name: 0.55, state: 0.3,
}

function scoreColumn(field, header, sampleValues) {
  const nonEmpty = sampleValues.filter((v) => v && v.trim() !== '')
  if (nonEmpty.length === 0) return 0

  const hint = HEADER_HINTS[field]
  const headerScore = hint && hint.test(header || '') ? 1 : 0

  const detector = PATTERN_DETECTORS[field]
  const hits = nonEmpty.filter((v) => detector(v)).length
  const patternScore = hits / nonEmpty.length

  const wH = HEADER_WEIGHT[field] ?? 0.5
  return headerScore * wH + patternScore * (1 - wH)
}

export const TARGET_FIELDS = [
  'email', 'first_name', 'last_name', 'phone',
  'title', 'district_name', 'state',
]

export function autoMap(headers, rows, sampleSize = 20) {
  const samples = rows.slice(0, sampleSize)
  const candidates = []

  headers.forEach((header, colIdx) => {
    const values = samples.map((r) => String(r[header] ?? r[colIdx] ?? ''))
    TARGET_FIELDS.forEach((field) => {
      const score = scoreColumn(field, header, values)
      if (score > 0.2) candidates.push({ field, column: header, score })
    })
  })

  candidates.sort((a, b) => b.score - a.score)

  const mapping = {}
  const usedColumns = new Set()
  for (const { field, column, score } of candidates) {
    if (mapping[field] || usedColumns.has(column)) continue
    mapping[field] = { column, confidence: score }
    usedColumns.add(column)
  }

  TARGET_FIELDS.forEach((f) => {
    if (!mapping[f]) mapping[f] = { column: null, confidence: 0 }
  })

  return mapping
}

export function applyMapping(rows, mapping) {
  return rows.map((row) => {
    const out = {}
    TARGET_FIELDS.forEach((field) => {
      const col = mapping[field]?.column
      out[field] = col ? String(row[col] ?? '').trim() : ''
    })
    return out
  })
}
