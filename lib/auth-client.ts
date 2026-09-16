'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export const signIn = { email: async ({ email, password }: { email: string; password: string }) => supabase.auth.signInWithPassword({ email, password }) }
export const signUp = { email: async ({ email, password, name, username, referralCode }: { email: string; password: string; name?: string; username?: string; referralCode?: string }) => supabase.auth.signUp({ email, password, options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback`, data: { name, username, referralCode: referralCode?.trim().toLowerCase() || null } } }) }
export const requestPasswordReset = (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
export const updatePassword = (password: string) => supabase.auth.updateUser({ password })
export const signOut = () => supabase.auth.signOut()

export function useSession() {
  const [data, setData] = useState<{ user: any } | null>(null)
  const [isPending, setIsPending] = useState(true)
  useEffect(() => { let mounted = true; supabase.auth.getUser().then(({ data: { user } }) => { if (mounted) { setData(user ? { user } : null); setIsPending(false) } }); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (mounted) { setData(session?.user ? { user: session.user } : null); setIsPending(false) } }); return () => { mounted = false; listener.subscription.unsubscribe() } }, [])
  return { data, isPending }
}
