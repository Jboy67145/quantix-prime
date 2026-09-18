'use server'

import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/auth'

const ADMIN_EMAIL = 'jboy67145@gmail.com'

export async function promoteInitialAdmin() {
  const user = await requireUser()
  if (user.email?.trim().toLowerCase() !== ADMIN_EMAIL) throw new Error('This email is not authorized for initial administrator setup.')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('Supabase administrator provisioning is not configured.')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '', serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: authError } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, role: 'SUPER_ADMIN' } })
  if (authError) throw new Error(authError.message)
  const { error: profileError } = await admin.from('user').upsert({ id: user.id, email: ADMIN_EMAIL, role: 'SUPER_ADMIN' }, { onConflict: 'id' })
  if (profileError) throw new Error(profileError.message)
  return { ok: true }
}
