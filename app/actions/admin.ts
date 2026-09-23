'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createUserNotification } from '@/app/actions/notifications'

async function getAdmin() {
  const { profile } = await requireAdminUser()
  return profile.id
}

export async function getPendingDeposits() {
  await getAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_deposits').select('*').eq('status', 'PENDING').order('created_at', { ascending: false })
  if (error) throw new Error('Unable to load deposits')
  return data ?? []
}

export async function reviewDeposit(input: { id: string; status: 'APPROVED' | 'REJECTED'; reason?: string }) {
  const adminId = await getAdmin()
  const supabase = await createClient()
  const reason = input.reason?.trim() || null
  const { data: deposit, error } = await supabase.rpc('review_deposit_atomic', {
    p_deposit_id: input.id,
    p_status: input.status,
    p_reason: reason,
  })
  if (error || !deposit) throw new Error(error?.message || 'Deposit is no longer pending')

  await createUserNotification({
    userId: deposit.user_id,
    title: input.status === 'APPROVED' ? 'Deposit approved' : 'Deposit rejected',
    body: input.status === 'APPROVED'
      ? 'Your wallet has been credited with the approved deposit amount.'
      : (reason || 'Your deposit proof was rejected.'),
    type: 'DEPOSIT',
  })
  await supabase.from('quantix_audit_logs').insert({
    actor_id: adminId,
    actor_role: 'ADMIN',
    action: `DEPOSIT_${input.status}`,
    target_type: 'DEPOSIT',
    target_id: input.id,
    reason,
    after_state: deposit,
  })
  revalidatePath('/admin')
  return deposit
}


const balanceAdjustmentSchema = z.object({
  userId: z.string().uuid(),
  amountMinor: z.number().int().refine((value) => value !== 0, 'Adjustment cannot be zero.').refine((value) => Math.abs(value) <= 100_000_000_000, 'Adjustment is too large.'),
  reason: z.string().trim().min(3).max(500),
  reference: z.string().trim().max(120).optional(),
})

export async function adjustUserBalance(input: z.input<typeof balanceAdjustmentSchema>) {
  await getAdmin()
  const data = balanceAdjustmentSchema.parse(input)
  const supabase = await createClient()
  const { data: result, error } = await supabase.rpc('admin_adjust_balance', {
    p_user_id: data.userId,
    p_amount_minor: data.amountMinor,
    p_reason: data.reason,
    p_reference: data.reference?.trim() || null,
  })
  if (error || !result) throw new Error(error?.message || 'Unable to adjust user balance')
  revalidatePath('/admin')
  return result
}
