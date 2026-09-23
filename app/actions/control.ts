'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdminUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createUserNotification } from '@/app/actions/notifications'

async function requireAdmin() {
  const { profile } = await requireAdminUser()
  return profile.id
}

export async function getAdminControlData() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ data: plans }, { data: accounts }, { data: withdrawals }, { data: settings }] = await Promise.all([
    supabase.from('quantix_plans').select('*').order('category').order('display_order'),
    supabase.from('quantix_payment_accounts').select('*').order('display_order'),
    supabase.from('quantix_withdrawals').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('quantix_withdrawal_settings').select('*').limit(1),
  ])
  return { plans: plans ?? [], accounts: accounts ?? [], withdrawals: withdrawals ?? [], settings: settings?.[0] ?? null }
}

const planSchema = z.object({ name: z.string().min(2), description: z.string().min(2), category: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']), minimumMinor: z.number().int().positive(), maximumMinor: z.number().int().positive(), returnBps: z.number().int().positive(), durationDays: z.number().int().positive(), terms: z.string().min(2) })
export async function createPlan(input: z.input<typeof planSchema>) {
  const actorId = await requireAdmin()
  const data = planSchema.parse(input)
  const supabase = await createClient()
  const { data: plan, error } = await supabase.from('quantix_plans').insert({ name: data.name, description: data.description, category: data.category, minimum_minor: data.minimumMinor, maximum_minor: data.maximumMinor, return_bps: data.returnBps, duration_days: data.durationDays, terms: data.terms }).select().single()
  if (error) throw new Error('Unable to create plan')
  await supabase.from('quantix_audit_logs').insert({ actor_id: actorId, actor_role: 'ADMIN', action: 'CREATE_PLAN', target_type: 'PLAN', target_id: plan.id })
  revalidatePath('/admin')
  return plan
}

export async function updateWithdrawalSettings(input: { timezone: string; enabledDays: string[]; startTime: string; endTime: string; minimumMinor: number; maximumMinor?: number | null; enabled: boolean }) {
  const actorId = await requireAdmin()
  const supabase = await createClient()
  const { data: existing } = await supabase.from('quantix_withdrawal_settings').select('id').limit(1).maybeSingle()
  const payload = { timezone: input.timezone, enabled_days: input.enabledDays, start_time: input.startTime, end_time: input.endTime, minimum_minor: input.minimumMinor, maximum_minor: input.maximumMinor ?? null, enabled: input.enabled, updated_at: new Date().toISOString() }
  const result = existing ? await supabase.from('quantix_withdrawal_settings').update(payload).eq('id', existing.id).select().single() : await supabase.from('quantix_withdrawal_settings').insert(payload).select().single()
  if (result.error) throw new Error('Unable to update withdrawal settings')
  await supabase.from('quantix_audit_logs').insert({ actor_id: actorId, actor_role: 'ADMIN', action: 'UPDATE_WITHDRAWAL_WINDOW', target_type: 'WITHDRAWAL_SETTINGS' })
  revalidatePath('/admin')
  return result.data
}

export async function reviewWithdrawal(id: string, status: 'APPROVED' | 'REJECTED', adminNote?: string) {
  const actorId = await requireAdmin()
  const supabase = await createClient()
  const note = adminNote?.trim() || null
  const { data: item, error } = await supabase.rpc('review_withdrawal_atomic', {
    p_withdrawal_id: id,
    p_status: status,
    p_admin_note: note,
  })
  if (error || !item) throw new Error(error?.message || 'Withdrawal is no longer pending')

  await createUserNotification({
    userId: item.user_id,
    title: status === 'APPROVED' ? 'Withdrawal approved' : 'Withdrawal rejected',
    body: note || `Your withdrawal request is ${status.toLowerCase()}.`,
    type: 'WITHDRAWAL',
  })
  await supabase.from('quantix_audit_logs').insert({
    actor_id: actorId,
    actor_role: 'ADMIN',
    action: `WITHDRAWAL_${status}`,
    target_type: 'WITHDRAWAL',
    target_id: id,
    reason: note,
    after_state: item,
  })
  revalidatePath('/admin')
  return item
}
