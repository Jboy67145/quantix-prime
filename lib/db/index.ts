import { createClient } from '@/lib/supabase/server'

export const db = {
  select: () => ({ from: async () => { const supabase = await createClient(); return supabase } }),
}

export { createClient as getSupabaseServerClient } from '@/lib/supabase/server'
