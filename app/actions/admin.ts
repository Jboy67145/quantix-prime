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
  const { data: deposit, error } = await supabase.from('quantix_deposits').update({ status: input.status, admin_note: input.reason?.trim() || null, reviewed_at: new Date().toISOString() }).eq('id', input.id).eq('status', 'PENDING').select().maybeSingle()
  if (error || !deposit) throw new Error('Deposit is no longer pending')
  if (input.status === 'APPROVED') {
    const { data: wallet } = await supabase.from('quantix_wallets').select('available_minor').eq('user_id', deposit.user_id).maybeSingle()
    if (wallet) await supabase.from('quantix_wallets').update({ available_minor: Number(wallet.available_minor) + Number(deposit.amount_minor), updated_at: new Date().toISOString() }).eq('user_id', deposit.user_id)
    await supabase.from('quantix_ledger_entries').upsert({ user_id: deposit.user_id, amount_minor: deposit.amount_minor, direction: 'CREDIT', type: 'DEPOSIT', reference: `deposit:${deposit.id}`, status: 'POSTED', metadata: { paymentAccountId: deposit.payment_account_id } }, { onConflict: 'reference', ignoreDuplicates: true })
  }
  await createUserNotification({ userId: deposit.user_id, title: input.status === 'APPROVED' ? 'Deposit approved' : 'Deposit rejected', body: input.status === 'APPROVED' ? 'Your wallet has been credited with the approved deposit amount.' : (input.reason?.trim() || 'Your deposit proof was rejected.'), type: 'DEPOSIT' })
  await supabase.from('quantix_audit_logs').insert({ actor_id: adminId, actor_role: 'ADMIN', action: `DEPOSIT_${input.status}`, target_type: 'DEPOSIT', target_id: input.id, reason: input.reason?.trim() || null, after_state: deposit })
  revalidatePath('/admin')
  return deposit
}
