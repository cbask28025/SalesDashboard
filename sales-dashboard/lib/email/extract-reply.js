// Extracts JUST the prospect's new reply from an email body, stripping
// the quoted/forwarded original message and any signature.
//
// Email clients put quoted-reply markers in lots of different places:
//   Gmail:        <div class="gmail_quote_attribution">…</div><blockquote>…</blockquote>
//   Outlook web:  <div id="appendonsend">…</div><hr>…
//   Outlook PC:   "From: … Sent: … To: … Subject: …" header
//   Apple Mail:   <blockquote type="cite">…</blockquote>
//   Generic:      "On <date> at <time>, <name> wrote:"
//   Plain text:   lines starting with ">"
//
// We strip all of those, then decode HTML entities and normalise whitespace.

const QUOTE_TRIGGERS_HTML = [
  // Microsoft / Outlook web's separator before the quoted message
  /<div\s+id=["']?appendonsend["']?[^>]*>[\s\S]*$/i,
  // Outlook desktop horizontal rule that precedes quoted block
  /<div[^>]*>\s*<hr[^>]*>[\s\S]*$/i,
  // Gmail quote wrapper (handles gmail_quote, gmail_quote_container, etc.)
  /<div[^>]*class=["'][^"']*gmail_quote[^"']*["'][\s\S]*$/i,
  // <blockquote> ... </blockquote>  (catches everything after the first blockquote)
  /<blockquote[\s\S]*$/i,
  // HTML wrapper around "On … wrote:" line that some clients use
  /<div[^>]*>\s*On\s+[^<]+wrote:\s*<\/div>[\s\S]*$/i,
]

const QUOTE_TRIGGERS_TEXT = [
  // "On Wed, May 13, 2026 at 9:17 PM Clifton Baskerville <foo@bar.com> wrote:"
  /^[ \t]*On\s+\w+,?\s+\w+\s+\d+,?\s+\d+[^\n]*\bwrote:[\s\S]*$/im,
  // Same pattern starting with "> " (some clients pre-quote it)
  /^[ \t]*>\s*On\s+[^\n]+wrote:[\s\S]*$/im,
  // Outlook desktop multi-line header: "From: ...\nSent: ...\nTo: ...\nSubject: ..."
  /^[ \t]*From:\s+[^\n]+\n[ \t]*Sent:[\s\S]*$/im,
  // Forwarded marker
  /^[ \t]*-{2,}\s*Forwarded message\s*-{2,}[\s\S]*$/im,
  // Original message marker
  /^[ \t]*-{2,}\s*Original Message\s*-{2,}[\s\S]*$/im,
]

const SIGNATURE_DELIMITERS = [
  /\n--\s*\n[\s\S]*$/,                              // standard "-- " sig delimiter
  /\n_+\n[\s\S]*$/,                                 // underscore line
  /\nSent from my (iPhone|iPad|Android|phone)[\s\S]*$/i, // mobile signatures
]

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
}

/**
 * Pull just the prospect's new content from an email body.
 * @param {string} htmlOrText - the body content (HTML or plain text)
 * @param {string} fallback - what to return if nothing extractable (e.g. bodyPreview)
 * @returns {string} - cleaned plain-text reply
 */
export function extractNewReply(htmlOrText, fallback = '') {
  if (!htmlOrText) return fallback

  // Strip HTML-level quote blocks first (preserves more structure than text-mode stripping)
  let working = htmlOrText
  for (const re of QUOTE_TRIGGERS_HTML) {
    working = working.replace(re, '')
  }

  // Convert remaining HTML to plain text
  let text = /<[a-z][\s\S]*?>/i.test(working) ? htmlToText(working) : working

  // Apply plain-text quote stripping for clients that don't use HTML wrappers
  for (const re of QUOTE_TRIGGERS_TEXT) {
    text = text.replace(re, '')
  }

  // Drop any remaining quoted lines (those starting with ">")
  text = text
    .split('\n')
    .filter((line) => !/^[\s]*>/.test(line))
    .join('\n')

  // Strip signature blocks
  for (const re of SIGNATURE_DELIMITERS) {
    text = text.replace(re, '')
  }

  // Normalise whitespace
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text || fallback
}
