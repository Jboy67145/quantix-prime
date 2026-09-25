import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    throw new Error('Enter a valid email address.')
  }
  return normalized
}

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = normalizeEmail(String(body?.email || ''))
    const password = String(body?.password || '')
    const name = cleanText(body?.name, 120)
    const username = cleanText(body?.username, 24).toLowerCase()
    const referralCode = cleanText(body?.referralCode, 32).toLowerCase()

    if (password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: 'Password must be between 8 and 72 characters.' }, { status: 400 })
    }
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      return NextResponse.json({ error: 'Username must be 3–24 characters using letters, numbers, or underscores.' }, { status: 400 })
    }
    if (!name) return NextResponse.json({ error: 'Enter your full name.' }, { status: 400 })

    const admin = createServiceClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, username, referral_code: referralCode || null },
    })

    if (error || !data.user) {
      const message = error?.message?.toLowerCase() || ''
      if (message.includes('already') || message.includes('registered')) {
        return NextResponse.json({ error: 'An account with this email already exists. Try signing in instead.' }, { status: 409 })
      }
      return NextResponse.json({ error: error?.message || 'Unable to create your account.' }, { status: 400 })
    }

    const user = data.user

    if (/^[a-z0-9_]{3,32}$/.test(referralCode)) {
      const { data: referrer } = await admin
        .from('profiles')
        .select('id')
        .eq('invite_code', referralCode)
        .neq('id', user.id)
        .maybeSingle()

      if (referrer) {
        await admin.from('profiles').update({ referred_by_code: referralCode }).eq('id', user.id)
        await admin.from('quantix_referrals').upsert(
          {
            referrer_user_id: referrer.id,
            referred_user_id: user.id,
            invite_code: referralCode,
            reward_minor: 0,
            status: 'PENDING',
          },
          { onConflict: 'referred_user_id' },
        )
      }
    }

    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      return NextResponse.json({ error: 'Account was created, but automatic sign-in failed. Please sign in with your password.' }, { status: 500 })
    }

    return NextResponse.json({ data: { session: true, user: { id: user.id, email: user.email } } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create your account.' },
      { status: 500 },
    )
  }
}
