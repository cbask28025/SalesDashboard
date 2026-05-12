import { getValidAccessToken } from './tokens'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

async function graphFetch(supabase, path, init = {}) {
  const token = await getValidAccessToken(supabase)
  if (!token) throw new Error('Outlook is not connected')

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  if (res.status === 204) return null
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Graph ${init.method || 'GET'} ${path} failed (${res.status}): ${text}`)
  }
  return text ? JSON.parse(text) : null
}

export async function sendMail(supabase, { to, subject, htmlBody, saveToSentItems = true, headers = {} }) {
  // /me/sendMail does NOT return message id, so use createMessage + send to capture it.
  const internetMessageHeaders = Object.entries(headers).map(([name, value]) => ({
    name: name.startsWith('x-') || name.startsWith('X-') ? name : `X-${name}`,
    value: String(value),
  }))

  const draft = await graphFetch(supabase, '/me/messages', {
    method: 'POST',
    body: JSON.stringify({
      subject,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: [{ emailAddress: { address: to } }],
      ...(internetMessageHeaders.length > 0 ? { internetMessageHeaders } : {}),
    }),
  })

  await graphFetch(supabase, `/me/messages/${draft.id}/send`, { method: 'POST' })

  if (!saveToSentItems) {
    // No-op — Graph sends keep a copy in Sent Items by default.
  }

  return {
    messageId: draft.id,
    internetMessageId: draft.internetMessageId,
    conversationId: draft.conversationId,
  }
}

export async function sendReply(supabase, { graphMessageId, htmlBody }) {
  // Reuses thread via Graph's createReply API which preserves headers.
  const draft = await graphFetch(supabase, `/me/messages/${graphMessageId}/createReply`, {
    method: 'POST',
  })

  await graphFetch(supabase, `/me/messages/${draft.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ body: { contentType: 'HTML', content: htmlBody } }),
  })

  await graphFetch(supabase, `/me/messages/${draft.id}/send`, { method: 'POST' })

  return {
    messageId: draft.id,
    internetMessageId: draft.internetMessageId,
    conversationId: draft.conversationId,
  }
}

export async function listInboxMessages(supabase, { sinceIso, top = 50 } = {}) {
  const filter = sinceIso ? `&$filter=receivedDateTime ge ${sinceIso}` : ''
  const url = `/me/mailFolders/Inbox/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,internetMessageId,conversationId,subject,from,toRecipients,bodyPreview,body,receivedDateTime,internetMessageHeaders${filter}`
  const data = await graphFetch(supabase, url)
  return data?.value || []
}

export async function getMessage(supabase, id) {
  return graphFetch(supabase, `/me/messages/${id}?$select=id,internetMessageId,conversationId,subject,body,from,toRecipients,receivedDateTime,internetMessageHeaders`)
}
