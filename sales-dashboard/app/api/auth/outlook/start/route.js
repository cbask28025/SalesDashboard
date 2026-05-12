import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { buildAuthUrl } from '../../../../../lib/graph/oauth'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirect('/login')
  }

  const state = crypto.randomUUID()
  cookies().set('outlook_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return redirect(buildAuthUrl(state))
}
