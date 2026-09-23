import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/env'

function safeNext(value: string | null) { return value && value.startsWith('/') && !value.startsWith('//') ? value : '/' }

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = safeNext(url.searchParams.get('next'))
  const appUrl = getAppUrl()
  if (!tokenHash || !type) return NextResponse.redirect(appUrl + '/sign-in?error=confirmation_failed')
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) return NextResponse.redirect(appUrl + '/sign-in?error=confirmation_failed')
  return NextResponse.redirect(appUrl + next)
}