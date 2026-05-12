// Shared auth check for Vercel Cron routes.
// Vercel cron jobs send `Authorization: Bearer <CRON_SECRET>` automatically.
// Allow `?secret=` query as a fallback for manual triggering.

export function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return process.env.NODE_ENV !== 'production'
  }
  const auth = request.headers.get('authorization') || ''
  if (auth === `Bearer ${secret}`) return true
  const url = new URL(request.url)
  return url.searchParams.get('secret') === secret
}
