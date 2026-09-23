import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicConfig } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = getSupabasePublicConfig()
  return createServerClient(
    url,
    key,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (cookiesToSet) => { for (const { name, value, options } of cookiesToSet) { cookieStore.set(name, value, options) } } } },
  )
}
