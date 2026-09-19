import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({}))
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail, options: { emailRedirectTo: `${new URL(request.url).origin}/auth/callback` } })
  if (error) return Response.json({ error: error.message || 'We could not resend the verification email.' }, { status: 400 })
  return Response.json({ sent: true })
}

export const runtime = 'nodejs'
