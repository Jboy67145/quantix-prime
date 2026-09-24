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
  const referralCode = typeof user.user_metadata?.referral_code === 'string' ? user.user_metadata.referral_code.trim().toLowerCase() : ''
  if (/^[a-z0-9_]{3,32}$/.test(referralCode)) {
    const { data: referrer } = await supabase.from('profiles').select('id').eq('invite_code', referralCode).neq('id', user.id).maybeSingle()
    if (referrer) {
      await supabase.from('profiles').update({ referred_by_code: referralCode }).eq('id', user.id)
      await supabase.from('quantix_referrals').upsert({ referrer_user_id: referrer.id, referred_user_id: user.id, invite_code: referralCode, reward_minor: 0, status: 'PENDING' }, { onConflict: 'referred_user_id' })
    }
  }
  return NextResponse.redirect(`${appUrl}${next}`)
}
