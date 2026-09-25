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
  return {
    plans: (plans ?? []).map((p: any) => ({
      ...p,
      minimumMinor: Number(p.minimum_minor),
      maximumMinor: Number(p.maximum_minor),
      returnBps: Number(p.return_bps),
      returnMinor: Number(p.return_minor || 0),
      durationDays: Number(p.duration_days),
      purchaseBonusMinor: Number(p.purchase_bonus_minor || 0),
    })),
    accounts: (accounts ?? []).map((a: any) => ({
      ...a,
      bankName: a.bank_name,
      accountName: a.account_name,
      accountNumber: a.account_number,
    })),
    withdrawals: (withdrawals ?? []).map((w: any) => ({
      ...w,
      userId: w.user_id,
      payoutAccountId: w.payout_account_id,
      amountMinor: Number(w.amount_minor),
      feeMinor: Number(w.fee_minor || 0),
      netMinor: Number(w.net_minor),
    })),
    settings: settings?.[0] ? {
      ...settings[0],
      enabledDays: settings[0].enabled_days,
      startTime: settings[0].start_time,
      endTime: settings[0].end_time,
      minimumMinor: Number(settings[0].minimum_minor),
      maximumMinor: settings[0].maximum_minor == null ? null : Number(settings[0].maximum_minor),
    } : null,
  }
}

const planSchema = z.object({ name: z.string().min(2), description: z.string().min(2), category: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']), minimumMinor: z.number().int().positive(), maximumMinor: z.number().int().positive(), returnMinor: z.number().int().nonnegative(), durationDays: z.number().int().positive(), terms: z.string().min(2) })
export async function createPlan(input: z.input<typeof planSchema>) {
  const actorId = await requireAdmin()
  const data = planSchema.parse(input)
  const supabase = await createClient()
  const { data: plan, error } = await supabase.from('quantix_plans').insert({ name: data.name, description: data.description, category: data.category, minimum_minor: data.minimumMinor, maximum_minor: data.maximumMinor, return_minor: data.returnMinor, return_bps: data.minimumMinor > 0 ? Math.round(data.returnMinor * 10000 / data.minimumMinor) : 0, duration_days: data.durationDays, terms: data.terms }).select().single()
  if (error) throw new Error('Unable to create plan')
  await supabase.from('quantix_audit_logs').insert({ actor_id: actorId, actor_role: 'ADMIN', action: 'CREATE_PLAN', target_type: 'PLAN', target_id: plan.id })
  revalidatePath('/admin')
  return plan
}

export async function updateWithdrawalSettings(input: { timezone: string; enabledDays: string[]; startTime: string; endTime: string; minimumMinor: number; maximumMinor?: number | null; enabled: boolean }) {
  const actorId = await requireAdmin()
  const supabase = await createClient()
  const { data: existing } = await supabase.from('quantix_withdrawal_settings').select('id').limit(1).maybeSingle()
  const minimumMinor = Math.max(100000, Math.round(Number(input.minimumMinor || 0)))
  const maximumMinor = input.maximumMinor == null ? null : Math.round(Number(input.maximumMinor))
  if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(input.startTime) || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(input.endTime)) throw new Error('Invalid withdrawal opening or closing time.')
  if (!Array.isArray(input.enabledDays) || input.enabledDays.length === 0) throw new Error('Select at least one withdrawal day.')
  if (maximumMinor !== null && maximumMinor < minimumMinor) throw new Error('Maximum withdrawal must be at least the minimum.')
  const payload = { timezone: input.timezone, enabled_days: input.enabledDays, start_time: input.startTime, end_time: input.endTime, minimum_minor: minimumMinor, maximum_minor: maximumMinor, enabled: Boolean(input.enabled), updated_at: new Date().toISOString() }
  const result = existing ? await supabase.from('quantix_withdrawal_settings').update(payload).eq('id', existing.id).select().single() : await supabase.from('quantix_withdrawal_settings').insert(payload).select().single()
  if (result.error) throw new Error('Unable to update withdrawal settings')
  await supabase.from('quantix_audit_logs').insert({ actor_id: actorId, actor_role: 'ADMIN', action: 'UPDATE_WITHDRAWAL_WINDOW', target_type: 'WITHDRAWAL_SETTINGS' })
  revalidatePath('/admin')
  return result.data
}

export async function reviewWithdrawal(id: string, status: 'APPROVED' | 'REJECTED', adminNote?: string) {
  await requireAdmin()
  const supabase = await createClient()
  const note = adminNote?.trim() || null
  const { data: item, error } = await supabase.rpc('review_withdrawal_atomic', {
    p_withdrawal_id: id,
    p_status: status,
    p_admin_note: note,
  })
  if (error || !item) throw new Error(error?.message || 'Withdrawal is no longer pending')

  try {
    await createUserNotification({
      userId: item.user_id,
      title: status === 'APPROVED' ? 'Withdrawal approved' : 'Withdrawal rejected',
      body: note || `Your withdrawal request is ${status.toLowerCase()}.`,
      type: 'WITHDRAWAL',
    })
  } catch (notificationError) {
    console.error('Withdrawal notification failed', notificationError)
  }
  revalidatePath('/admin')
  return item
}
