import { createClient } from '@supabase/supabase-js'
import { getAppUrl, getSupabasePublicConfig } from '@/lib/env'

export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({}))
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })

  const appUrl = getAppUrl()
  const { url, key } = getSupabasePublicConfig()
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail, options: { emailRedirectTo: `${appUrl}/auth/callback` } })
  if (error) return Response.json({ error: error.message || 'We could not resend the verification email.' }, { status: 400 })
  return Response.json({ sent: true })
}

export const runtime = 'nodejs'
