import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({}))
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await supabase.auth.admin.generateLink({ type: 'signup', email: normalizedEmail, password: crypto.randomUUID(), options: { redirectTo: `${new URL(request.url).origin}/auth/callback` } })
  if (error || !data.properties?.action_link) return Response.json({ error: 'We could not create a verification link. Confirm the account exists, then try again.' }, { status: 400 })

  const from = process.env.RESEND_EMAIL_DOMAIN ? `Quantix Prime <no-reply@${process.env.RESEND_EMAIL_DOMAIN}>` : 'Quantix Prime <onboarding@resend.dev>'
  const resend = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [normalizedEmail], subject: 'Verify your Quantix Prime account', html: `<p>Welcome to Quantix Prime.</p><p><a href="${data.properties.action_link}">Verify your email address</a></p><p>This link expires for security. If you did not request this, you can ignore this email.</p>`, headers: { 'X-Entity-Ref-ID': `verify/${normalizedEmail}` } }) })
  if (!resend.ok) return Response.json({ error: 'The email provider rejected the message. Please check the verified sending domain.' }, { status: 502 })
  return Response.json({ sent: true })
}

export const runtime = 'nodejs'
