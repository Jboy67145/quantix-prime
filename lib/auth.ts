import { createClient } from '@/lib/supabase/server'

async function getSession() {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      return data.user ? { user: data.user } : null
    }

export const auth = {
  getSession,
  api: {
    getSession: async () => {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      return data.user ? { user: data.user } : null
    },
  },
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}

const ADMIN_EMAIL_ALLOWLIST = new Set([
  'mondayjoshua329@gmail.com',
  'jboy67145@gmail.com',
  'quantixprime@atomicmail.io',
])

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireAdminUser() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: profile } = await supabase.from('user').select('id, role, email').eq('id', user.id).maybeSingle()
  if (!profile || String(profile.role).toUpperCase() !== 'ADMIN') throw new Error('Forbidden')
  return { user, profile }
}
