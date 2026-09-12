import { createClient } from '@/lib/supabase/server'

export const auth = {
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
