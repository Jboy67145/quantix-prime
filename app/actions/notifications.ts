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


export async function getAdminNotificationSettings() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['ADMIN','SUPER_ADMIN'].includes(profile.role)) throw new Error('Unauthorized')
  const { data, error } = await supabase
    .from('quantix_admin_notification_settings')
    .select('withdrawal_enabled,deposit_enabled')
    .eq('admin_id', user.id)
    .maybeSingle()
  if (error) throw new Error('Unable to load admin notification settings')
  return data ?? { withdrawal_enabled: true, deposit_enabled: true }
}

export async function saveAdminNotificationSettings(input: { withdrawalEnabled: boolean; depositEnabled: boolean }) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['ADMIN','SUPER_ADMIN'].includes(profile.role)) throw new Error('Unauthorized')
  const { error } = await supabase.from('quantix_admin_notification_settings').upsert({
    admin_id: user.id,
    withdrawal_enabled: Boolean(input.withdrawalEnabled),
    deposit_enabled: Boolean(input.depositEnabled),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'admin_id' })
  if (error) throw new Error('Unable to save admin notification settings')
  revalidatePath('/admin')
}

export async function getAdminPushPublicKey() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['ADMIN','SUPER_ADMIN'].includes(profile.role)) throw new Error('Unauthorized')
  const { getSupabasePublicConfig } = await import('@/lib/env')
  const { url, key } = getSupabasePublicConfig()
  const response = await fetch(url + '/functions/v1/quantix-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ action: 'init' }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Unable to initialize secure phone notifications')
  const payload = await response.json()
  if (!payload?.publicKey) throw new Error('Push service did not return a public key')
  return String(payload.publicKey)
}
