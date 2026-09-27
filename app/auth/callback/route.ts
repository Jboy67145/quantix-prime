import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/env'

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('next'))
  const appUrl = getAppUrl()
  const supabase = await createClient()
  const code = url.searchParams.get('code')
  if (!code) return NextResponse.redirect(`${appUrl}/sign-in?error=confirmation_failed`)
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) return NextResponse.redirect(`${appUrl}/sign-in?error=confirmation_failed`)
  const { data: authData, error: userError } = await supabase.auth.getUser()
  if (userError || !authData.user) return NextResponse.redirect(`${appUrl}/sign-in?error=confirmation_failed`)
  const user = authData.user
  const referralCode = typeof user.user_metadata?.referral_code === 'string' ? user.user_metadata.referral_code.trim().toUpperCase() : ''
  if (referralCode) {
    // Idempotent fallback for magic-link/email confirmation flows.
    await supabase.rpc('attach_referral_atomic', {
      p_referred_user_id: user.id,
      p_referral_code: referralCode,
    })
  }

  return NextResponse.redirect(`${appUrl}${next}`)
}
