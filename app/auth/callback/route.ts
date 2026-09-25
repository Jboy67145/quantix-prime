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
  if (/^[A-Z0-9_]{3,32}$/.test(referralCode)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, invite_code, referred_by_code')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.referred_by_code) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id, invite_code')
        .ilike('invite_code', referralCode)
        .neq('id', user.id)
        .maybeSingle()

      if (referrer) {
        await supabase.from('profiles')
          .update({ referred_by_code: referrer.invite_code })
          .eq('id', user.id)
          .is('referred_by_code', null)

        await supabase.from('quantix_referrals').insert({
          referrer_user_id: referrer.id,
          referred_user_id: user.id,
          invite_code: referrer.invite_code,
          reward_minor: 0,
          status: 'PENDING',
        })
      }
    }
  }
  return NextResponse.redirect(`${appUrl}${next}`)
}
