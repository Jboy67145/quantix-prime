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
  const user = await getCurrentUser()
  if (!user) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quantix_notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw new Error('Unable to load notifications')
  return data ?? []
}

export async function getMarqueeHighlights() {
  const user = await getCurrentUser()
  if (!user) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quantix_marquee_items')
    .select('id,title,content,kind,created_at,user_id')
    .eq('active', true)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(8)
  if (error) throw new Error('Unable to load highlights')
  return data ?? []
}

export async function createUserNotification(input: { userId: string; title: string; body: string; type?: string }) {
  const supabase = await createClient()
  const { error } = await supabase.from('quantix_notifications').insert({
    user_id: input.userId,
    title: input.title,
    body: input.body,
    type: input.type || 'SYSTEM',
    delivery_status: 'IN_APP',
  })
  if (error) throw new Error('Unable to create notification')
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

export async function markAllNotificationsRead() {
  const userId = await uid()
  const supabase = await createClient()
  const { error } = await supabase
    .from('quantix_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw new Error('Unable to mark notifications as read')
  revalidatePath('/')
}

export async function clearNotifications() {
  const userId = await uid()
  const supabase = await createClient()
  const { error } = await supabase
    .from('quantix_notifications')
    .delete()
    .eq('user_id', userId)
  if (error) throw new Error('Unable to clear notifications')
  revalidatePath('/')
}

export async function saveNotificationSubscription(input: {
  endpoint: string
  p256dh: string
  auth: string
}) {
  const userId = await uid()
  const endpoint = z.string().url().parse(input.endpoint)
  const p256dh = z.string().min(1).max(500).parse(input.p256dh)
  const auth = z.string().min(1).max(500).parse(input.auth)
  const supabase = await createClient()
  const { error } = await supabase
    .from('quantix_notification_subscriptions')
    .upsert(
      { user_id: userId, endpoint, p256dh, auth, last_used_at: new Date().toISOString() },
      { onConflict: 'endpoint' }
    )
  if (error) throw new Error('Unable to enable phone notifications')
}

export async function removeNotificationSubscription(endpoint: string) {
  const userId = await uid()
  const value = z.string().url().parse(endpoint)
  const supabase = await createClient()
  const { error } = await supabase
    .from('quantix_notification_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', value)
  if (error) throw new Error('Unable to disable phone notifications')
}
