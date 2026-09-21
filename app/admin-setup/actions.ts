'use server'

import { createClient } from '@supabase/supabase-js'
import { getSupabasePublicConfig } from '@/lib/env'

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) throw new Error('Administrator provisioning is not configured.')
  const { url } = getSupabasePublicConfig()
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function provisionInitialAdmin(email: string, password: string, setupSecret: string) {
  const configuredEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
  const configuredSecret = process.env.INITIAL_ADMIN_SETUP_SECRET?.trim()
  const normalizedEmail = email.trim().toLowerCase()
  if (!configuredEmail || !configuredSecret) throw new Error('Initial administrator setup is not configured.')
  if (setupSecret !== configuredSecret || normalizedEmail !== configuredEmail) throw new Error('The administrator email or setup secret is invalid.')
  if (password.length < 8) throw new Error('Password must be at least 8 characters.')

  const admin = getAdminClient()
  const { data: existingAdmins, error: adminListError } = await admin.from('profiles').select('id').in('role', ['ADMIN', 'SUPER_ADMIN']).limit(1)
  if (adminListError) throw new Error('Unable to verify administrator setup status.')
  if (existingAdmins?.length) throw new Error('Administrator setup has already been completed.')

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (usersError) throw new Error(usersError.message)
  let authUser = users.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail)
  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({ email: normalizedEmail, password, email_confirm: false, user_metadata: { full_name: 'Quantix Prime Administrator' } })
    if (error || !data.user) throw new Error(error?.message || 'Unable to create administrator account.')
    authUser = data.user
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(authUser.id, { app_metadata: { ...(authUser.app_metadata || {}), role: 'SUPER_ADMIN' } })
  if (metadataError) throw new Error(metadataError.message)
  const { error: profileError } = await admin.from('profiles').upsert({ id: authUser.id, email: normalizedEmail, role: 'SUPER_ADMIN' }, { onConflict: 'id' })
  if (profileError) throw new Error(profileError.message)
  await admin.from('quantix_audit_logs').insert({ actor_id: authUser.id, actor_role: 'SUPER_ADMIN', action: 'INITIAL_ADMIN_PROVISIONED', target_type: 'PROFILE', target_id: authUser.id, after_state: { email: normalizedEmail, role: 'SUPER_ADMIN' } })
  return { ok: true, emailConfirmed: Boolean(authUser.email_confirmed_at) }
}
