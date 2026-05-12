// Tracking pixel + link rewriting for outbound emails.
// Both endpoints accept ?sid=<email_send_id> via path param.

function trackingBaseUrl() {
  return process.env.TRACKING_DOMAIN
    || process.env.NEXT_PUBLIC_APP_URL
    || 'http://localhost:3000'
}

export function pixelUrl(sendId) {
  return `${trackingBaseUrl()}/api/track/open/${sendId}.gif`
}

export function clickUrl(sendId, target) {
  const u = new URL(`${trackingBaseUrl()}/api/track/click/${sendId}`)
  u.searchParams.set('u', target)
  return u.toString()
}

export function injectTracking(htmlBody, sendId) {
  // 1) Rewrite anchor hrefs to go through the click tracker.
  const rewritten = htmlBody.replace(/<a([^>]*?)href="([^"]+)"/gi, (match, attrs, href) => {
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return match
    return `<a${attrs}href="${clickUrl(sendId, href)}"`
  })

  // 2) Append 1x1 transparent tracking pixel at the end.
  const pixel = `<img src="${pixelUrl(sendId)}" width="1" height="1" alt="" style="display:none" />`
  return rewritten + pixel
}
