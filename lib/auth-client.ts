'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getClientAppUrl } from '@/lib/app-url'

type AuthResult = { data?: { session?: boolean; user?: { id: string; email?: string | null } }; error?: { message: string } }

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error('Enter a valid email address.')
  return normalized
}

async function authRequest(path: string, body: Record<string, unknown>): Promise<AuthResult> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) return { error: { message: result.error || 'Authentication request failed.' } }
  return result
}

export const signIn = {
  email: async ({ email, password }: { email: string; password: string }) =>
    authRequest('/api/auth/sign-in', { email: normalizeEmail(email), password }),
}

export const signUp = {
  email: async ({
    email,
    password,
    name,
    username,
    referralCode,
  }: {
    email: string
    password: string
    name?: string
    username?: string
    referralCode?: string
  }) =>
    authRequest('/api/auth/sign-up', {
      email: normalizeEmail(email),
      password,
      name: name?.trim(),
      username: username?.trim().toLowerCase(),
      referralCode: referralCode?.trim().toLowerCase() || null,
    }),
}

export const requestPasswordReset = (email: string) =>
  createClient().auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: `${getClientAppUrl()}/auth/callback?next=/reset-password`,
  })

export const updatePassword = (password: string) => createClient().auth.updateUser({ password })

export const signOut = async () => {
  await fetch('/api/auth/sign-out', { method: 'POST' })
}

export function useSession() {
  const [data, setData] = useState<{ user: { id: string; email?: string | null } } | null>(null)
  const [isPending, setIsPending] = useState(true)

  useEffect(() => {
    let mounted = true

    fetch('/api/auth/session', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session request failed')
        return response.json()
      })
      .then((result) => {
        if (mounted) {
          setData(result.user ? { user: result.user } : null)
          setIsPending(false)
        }
      })
      .catch(() => {
        if (mounted) {
          setData(null)
          setIsPending(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  return { data, isPending }
}
