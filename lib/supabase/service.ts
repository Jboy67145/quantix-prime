import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getSupabasePublicConfig } from '@/lib/env'

export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) throw new Error('Supabase service role is not configured.')
  const { url } = getSupabasePublicConfig()
  return createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}
