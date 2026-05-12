import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForToken, fetchUserProfile } from '../../../../../lib/graph/oauth'
import { storeTokens } from '../../../../../lib/graph/tokens'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')

  if (error) {
    const target = new URL('/settings', request.url)
    target.searchParams.set('outlook_error', errorDescription || error)
    return NextResponse.redirect(target)
  }

  const cookieStore = cookies()
  const expectedState = cookieStore.get('outlook_oauth_state')?.value
  cookieStore.delete('outlook_oauth_state')

  if (!code || !state || state !== expectedState) {
    const target = new URL('/settings', request.url)
    target.searchParams.set('outlook_error', 'OAuth state mismatch')
    return NextResponse.redirect(target)
  }

  try {
    const tokenResp = await exchangeCodeForToken(code)
    const profile = await fetchUserProfile(tokenResp.access_token)
    const expiresAtIso = new Date(Date.now() + tokenResp.expires_in * 1000).toISOString()

    await storeTokens(supabase, {
      access_token: tokenResp.access_token,
      refresh_token: tokenResp.refresh_token,
      expires_at: expiresAtIso,
      scope: tokenResp.scope,
      account_email: profile.mail || profile.userPrincipalName,
      account_id: profile.id,
      connected_at: new Date().toISOString(),
    })

    const target = new URL('/settings', request.url)
    target.searchParams.set('outlook_connected', '1')
    return NextResponse.redirect(target)
  } catch (err) {
    const target = new URL('/settings', request.url)
    target.searchParams.set('outlook_error', err.message || 'Token exchange failed')
    return NextResponse.redirect(target)
  }
}
