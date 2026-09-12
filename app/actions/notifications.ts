'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

async function uid() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

export async function getNotifications() {
  const userId = await uid()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quantix_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw new Error('Unable to load notifications')
  return data ?? []
}

export async function markNotificationRead(id: string) {
  const userId = await uid()
  const notificationId = z.string().uuid().parse(id)
  const supabase = await createClient()
  const { error } = await supabase
    .from('quantix_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
  if (error) throw new Error('Unable to update notification')
  revalidatePath('/')
}
