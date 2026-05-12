// Direct OAuth2 against Microsoft identity platform — no msal dependency.
// Scopes cover send + read + offline (refresh) + identity.

const SCOPES = [
  'offline_access',
  'User.Read',
  'Mail.Send',
  'Mail.ReadWrite',
  'Mail.Read',
].join(' ')

function tenant() {
  return process.env.MS_GRAPH_TENANT_ID || 'common'
}

function authority() {
  return `https://login.microsoftonline.com/${tenant()}`
}

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.MS_GRAPH_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: process.env.MS_GRAPH_REDIRECT_URI || '',
    response_mode: 'query',
    scope: SCOPES,
    state,
    prompt: 'select_account',
  })
  return `${authority()}/oauth2/v2.0/authorize?${params.toString()}`
}

export async function exchangeCodeForToken(code) {
  const params = new URLSearchParams({
    client_id: process.env.MS_GRAPH_CLIENT_ID || '',
    client_secret: process.env.MS_GRAPH_CLIENT_SECRET || '',
    redirect_uri: process.env.MS_GRAPH_REDIRECT_URI || '',
    code,
    grant_type: 'authorization_code',
    scope: SCOPES,
  })
  const res = await fetch(`${authority()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }
  return res.json()
}

export async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    client_id: process.env.MS_GRAPH_CLIENT_ID || '',
    client_secret: process.env.MS_GRAPH_CLIENT_SECRET || '',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES,
  })
  const res = await fetch(`${authority()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Refresh failed (${res.status}): ${text}`)
  }
  return res.json()
}

export async function fetchUserProfile(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`)
  return res.json()
}
