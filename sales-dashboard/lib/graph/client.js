import { getValidAccessToken } from './tokens'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// Friendly translations for Graph error codes we hit most often.
const GRAPH_ERROR_GUIDANCE = {
  MailboxNotEnabledForRESTAPI: 'This Microsoft account doesn\'t have an active mailbox. Personal Microsoft accounts that use a non-Microsoft email address (e.g. @gmail.com as username) typically hit this. Disconnect and reconnect with an outlook.com, hotmail.com, or M365 business account.',
  ErrorAccessDenied: 'The account is connected but is missing one of the Mail.* permissions. Disconnect and reconnect, making sure to approve every permission Microsoft prompts for.',
  InvalidAuthenticationToken: 'The Microsoft access token was rejected. Try disconnecting and reconnecting Outlook.',
  ApplicationThrottled: 'Microsoft is throttling this account temporarily. Wait a few minutes and try again.',
  ResourceNotFound: 'The mailbox or folder Graph tried to access doesn\'t exist. Reconnect Outlook.',
}

function parseGraphError(text) {
  try {
    const parsed = JSON.parse(text)
    const code = parsed?.error?.code || parsed?.code || null
    const message = parsed?.error?.message || parsed?.message || text
    return { code, message }
  } catch {
    return { code: null, message: text }
  }
}

class GraphError extends Error {
  constructor({ status, code, message, hint }) {
    super(message)
    this.name = 'GraphError'
    this.status = status
    this.code = code
    this.hint = hint || null
  }
}

async function graphFetch(supabase, path, init = {}) {
  const token = await getValidAccessToken(supabase)
  if (!token) {
    throw new GraphError({ status: 0, code: 'NotConnected', message: 'Outlook is not connected', hint: 'Go to Settings and click Connect Outlook.' })
  }

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
    const { code, message } = parseGraphError(text)
    const hint = code && GRAPH_ERROR_GUIDANCE[code] ? GRAPH_ERROR_GUIDANCE[code] : null
    throw new GraphError({ status: res.status, code, message, hint })
  }
  return text ? JSON.parse(text) : null
}

export { GraphError }

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
