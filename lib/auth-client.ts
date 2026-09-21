'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { getClientAppUrl } from '@/lib/app-url'

function getSupabase() {
  return createClient()
}

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error('Enter a valid email address.')
  return normalized
}

export const signIn = { email: async ({ email, password }: { email: string; password: string }) => getSupabase().auth.signInWithPassword({ email: normalizeEmail(email), password }) }
export const signUp = { email: async ({ email, password, name, username, referralCode }: { email: string; password: string; name?: string; username?: string; referralCode?: string }) => getSupabase().auth.signUp({ email: normalizeEmail(email), password, options: { emailRedirectTo: `${getClientAppUrl()}/auth/callback`, data: { full_name: name?.trim(), username: username?.trim().toLowerCase(), referral_code: referralCode?.trim().toLowerCase() || null } } }) }
export const requestPasswordReset = (email: string) => getSupabase().auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: `${getClientAppUrl()}/auth/callback?next=/reset-password` })
export const updatePassword = (password: string) => getSupabase().auth.updateUser({ password })
export const signOut = () => getSupabase().auth.signOut()

export function useSession() {
  const [data, setData] = useState<{ user: User } | null>(null)
  const [isPending, setIsPending] = useState(true)
  useEffect(() => { const supabase = getSupabase(); let mounted = true; supabase.auth.getUser().then(({ data: { user } }) => { if (mounted) { setData(user ? { user } : null); setIsPending(false) } }); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (mounted) { setData(session?.user ? { user: session.user } : null); setIsPending(false) } }); return () => { mounted = false; listener.subscription.unsubscribe() } }, [])
  return { data, isPending }
}
