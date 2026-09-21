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

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireAdminUser() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: profile, error } = await supabase.from('profiles').select('id, role, email, status').eq('id', user.id).maybeSingle()
  if (error) throw new Error('Unable to verify administrator permissions.')
  if (!profile) throw new Error('Administrator profile not found.')
  if (String(profile.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') throw new Error('Administrator account is suspended.')
  const role = String(profile.role || '').toUpperCase()
  if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) throw new Error('Forbidden')
  return { user, profile }
}

export async function requireSuperAdminUser() {
  const { user, profile } = await requireAdminUser()
  const role = String(profile.role || user.app_metadata?.role || '').toUpperCase()
  if (role !== 'SUPER_ADMIN') throw new Error('Super-admin access required')
  return { user, profile }
}
