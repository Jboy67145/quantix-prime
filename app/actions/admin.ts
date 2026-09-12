'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

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
  await supabase.from('quantix_audit_logs').insert({ actor_id: adminId, actor_role: 'ADMIN', action: `DEPOSIT_${input.status}`, target_type: 'DEPOSIT', target_id: input.id, reason: input.reason?.trim() || null, after_state: deposit })
  revalidatePath('/admin')
  return deposit
}
