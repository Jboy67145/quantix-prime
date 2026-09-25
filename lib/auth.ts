import { createClient } from '@/lib/supabase/server'

async function getSession() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user ? { user: data.user } : null
}

export const auth = {
  getSession,
  api: { getSession },
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  const { data: profile } = await supabase.from('profiles').select('status').eq('id', data.user.id).maybeSingle()
  if (profile && profile.status && profile.status !== 'ACTIVE') return null
  return data.user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireAdminUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Unauthorized')
  const { data: profile, error } = await supabase.from('profiles').select('id, role, status').eq('id', data.user.id).maybeSingle()
  if (error) throw new Error('Unable to verify administrator permissions.')
  if (!profile) throw new Error('Administrator profile not found.')
  const role = String(profile.role || '').toUpperCase()
  if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) throw new Error('Forbidden')
  return { user: data.user, profile }
}

export async function requireSuperAdminUser() {
  const { user, profile } = await requireAdminUser()
  const role = String(profile.role || user.app_metadata?.role || '').toUpperCase()
  if (role !== 'SUPER_ADMIN') throw new Error('Super-admin access required')
  return { user, profile }
}
