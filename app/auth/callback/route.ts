import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) return NextResponse.redirect(new URL('/sign-in?error=confirmation', request.url))
    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    const referralCode = typeof user?.user_metadata?.referralCode === 'string' ? user.user_metadata.referralCode.trim().toLowerCase() : ''
    if (user && /^[a-z0-9_]{3,32}$/.test(referralCode)) {
      const { data: referrer } = await supabase.from('user').select('id').or(`invite_code.eq.${referralCode},username.eq.${referralCode}`).neq('id', user.id).maybeSingle()
      if (referrer) {
        await supabase.from('user').update({ referred_by_code: referralCode }).eq('id', user.id)
        await supabase.from('quantix_referrals').upsert({ referrer_user_id: referrer.id, referred_user_id: user.id, invite_code: referralCode, referrer_bonus_minor: 0, invitee_bonus_minor: 0, reward_minor: 0, status: 'PENDING' }, { onConflict: 'referred_user_id' })
      }
    }
  }
  return NextResponse.redirect(new URL('/', request.url))
}
