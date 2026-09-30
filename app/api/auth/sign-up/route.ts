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

function usernameTakenMessage(username: string) {
  return `The username "@${username}" is already taken. Please choose another username.`
}

export async function POST(request: Request) {
  let createdUserId: string | null = null

  try {
    const body = await request.json()
    const email = normalizeEmail(String(body?.email || ''))
    const password = String(body?.password || '')
    const name = cleanText(body?.name, 120)
    const username = cleanText(body?.username, 24).toLowerCase()
    const referralCode = cleanText(body?.referralCode, 32).toUpperCase()

    if (password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: 'Password must be between 8 and 72 characters.' }, { status: 400 })
    }
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      return NextResponse.json({ error: 'Username must be 3–24 characters using letters, numbers, or underscores.' }, { status: 400 })
    }
    if (!name) return NextResponse.json({ error: 'Enter your full name.' }, { status: 400 })

    const admin = createServiceClient()

    // Check the username before touching Auth. This turns the common unique-username
    // collision into a fast, actionable 409 instead of Supabase's generic
    // "Database error creating new user" response from the auth.users trigger.
    const { data: existingProfile, error: usernameLookupError } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .limit(1)
      .maybeSingle()

    if (usernameLookupError) {
      return NextResponse.json(
        { error: 'Registration service is temporarily unavailable. Please try again in a moment.' },
        { status: 503 },
      )
    }

    if (existingProfile) {
      return NextResponse.json({ error: usernameTakenMessage(username) }, { status: 409 })
    }

    // The auth.users trigger creates the profile before this route can finish.
    // Give the trigger a guaranteed-unique temporary username, then set the
    // requested username after Auth succeeds. This removes the race where two
    // people submit the same username at almost the same time.
    const pendingUsername = `pending_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, username: pendingUsername, referral_code: referralCode || null },
    })

    if (error || !data.user) {
      const message = error?.message?.toLowerCase() || ''
      if (message.includes('already') || message.includes('registered')) {
        return NextResponse.json({ error: 'An account with this email already exists. Try signing in instead.' }, { status: 409 })
      }
      if (message.includes('database error creating new user')) {
        return NextResponse.json(
          { error: 'We could not complete registration because the account database is temporarily unavailable. Please try again.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: error?.message || 'Unable to create your account.' }, { status: 400 })
    }

    const user = data.user
    createdUserId = user.id

    // Finalize the profile with the requested username/name. If another request
    // won the username race, the unique constraint is handled below and the new
    // auth user is cleaned up rather than leaving a broken partial account.
    const { data: updatedProfile, error: profileError } = await admin
      .from('profiles')
      .update({ name, username })
      .eq('id', user.id)
      .select('id')
      .maybeSingle()

    if (profileError || !updatedProfile) {
      await admin.auth.admin.deleteUser(user.id, false).catch(() => undefined)
      createdUserId = null

      if (profileError?.code === '23505' || profileError?.message.toLowerCase().includes('duplicate')) {
        return NextResponse.json({ error: usernameTakenMessage(username) }, { status: 409 })
      }

      return NextResponse.json(
        { error: 'We could not finish setting up your account. No account was created. Please try again.' },
        { status: 503 },
      )
    }

    // Keep the wallet invariant even if an older trigger deployment missed it.
    const { error: walletError } = await admin
      .from('quantix_wallets')
      .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })

    if (walletError) {
      await admin.auth.admin.deleteUser(user.id, false).catch(() => undefined)
      createdUserId = null
      return NextResponse.json(
        { error: 'We could not finish setting up your account. No account was created. Please try again.' },
        { status: 503 },
      )
    }

    if (referralCode) {
      const { error: referralError } = await admin.rpc('attach_referral_atomic', {
        p_referred_user_id: user.id,
        p_referral_code: referralCode,
      })
      if (referralError) {
        // Referral attachment must never block account creation. The code is optional.
        // The callback performs the same idempotent attachment after session creation.
      }
    }

    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      return NextResponse.json({ error: 'Account was created, but automatic sign-in failed. Please sign in with your password.' }, { status: 500 })
    }

    createdUserId = null
    return NextResponse.json({ data: { session: true, user: { id: user.id, email: user.email } } })
  } catch (error) {
    // Only the cleanup paths above delete a known, newly-created user. Do not
    // delete an account here unless we have positively identified it as ours.
    if (createdUserId) {
      try {
        const admin = createServiceClient()
        await admin.auth.admin.deleteUser(createdUserId, false)
      } catch {
        // Preserve the original registration error.
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create your account.' },
      { status: 500 },
    )
  }
}
