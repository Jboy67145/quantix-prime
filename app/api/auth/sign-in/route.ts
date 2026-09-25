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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = normalizeEmail(String(body?.email || ''))
    const password = String(body?.password || '')

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const supabase = await createClient()
    let { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error?.message?.toLowerCase().includes('email not confirmed')) {
      const admin = createServiceClient()
      const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const match = users?.users?.find((candidate) => candidate.email?.toLowerCase() === email)

      if (!listError && match) {
        const { error: confirmError } = await admin.auth.admin.updateUserById(match.id, { email_confirm: true })
        if (!confirmError) {
          const retry = await supabase.auth.signInWithPassword({ email, password })
          error = retry.error
        }
      }
    }

    if (error) {
      const message = error.message?.toLowerCase() || ''
      if (message.includes('invalid login credentials')) {
        return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 })
      }
      return NextResponse.json({ error: error.message || 'Unable to sign in.' }, { status: 401 })
    }

    return NextResponse.json({ data: { session: true } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to sign in.' },
      { status: 500 },
    )
  }
}
