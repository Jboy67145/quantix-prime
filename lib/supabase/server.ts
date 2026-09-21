import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicConfig } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = getSupabasePublicConfig()
  return createServerClient(
    url,
    key,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (cookiesToSet) => { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} } } },
  )
}
