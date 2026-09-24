'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdminUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

type AccountInput = {
  id?: string
  bankName: string
  accountNumber: string
  accountName: string
  label: string
  active: boolean
  displayOrder: number
}

function clean(input: AccountInput) {
  const bankName = input.bankName.trim().slice(0, 80)
  const accountNumber = input.accountNumber.replace(/\s+/g, '').slice(0, 32)
  const accountName = input.accountName.trim().slice(0, 120)
  const label = input.label.trim().slice(0, 160)
  const displayOrder = Math.max(0, Math.min(999, Math.trunc(Number(input.displayOrder))))
  if (!bankName || !accountNumber || !accountName || !label) throw new Error('Complete every payment-account field.')
  if (!/^[0-9A-Za-z-]{4,32}$/.test(accountNumber)) throw new Error('Enter a valid account number.')
  if (!Number.isFinite(displayOrder)) throw new Error('Enter a valid display order.')
  return { bank_name: bankName, account_number: accountNumber, account_name: accountName, label, active: Boolean(input.active), display_order: displayOrder }
}

export async function listPaymentAccounts() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_payment_accounts').select('*').order('display_order', { ascending: true })
  if (error) throw new Error(`Unable to load payment accounts: ${error.message}`)
  return data ?? []
}

export async function savePaymentAccount(input: AccountInput) {
  const { user, profile } = await requireSuperAdminUser()
  const supabase = await createClient()
  const payload = clean(input)
  const query = input.id
    ? supabase.from('quantix_payment_accounts').update(payload).eq('id', input.id).select().single()
    : supabase.from('quantix_payment_accounts').insert(payload).select().single()
  const { data, error } = await query
  if (error) throw new Error(`Unable to save payment account: ${error.message}`)
  await supabase.from('quantix_audit_logs').insert({ actor_id: user.id, actor_role: profile.role, action: input.id ? 'PAYMENT_ACCOUNT_UPDATED' : 'PAYMENT_ACCOUNT_CREATED', target_type: 'PAYMENT_ACCOUNT', target_id: data.id, after_state: data })
  revalidatePath('/admin/accounts')
  revalidatePath('/admin')
  return data
}

export async function setPaymentAccountActive(id: string, active: boolean) {
  const { user, profile } = await requireSuperAdminUser()
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid payment account.')
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_payment_accounts').update({ active }).eq('id', id).select().single()
  if (error) throw new Error(`Unable to update payment account: ${error.message}`)
  await supabase.from('quantix_audit_logs').insert({ actor_id: user.id, actor_role: profile.role, action: active ? 'PAYMENT_ACCOUNT_ACTIVATED' : 'PAYMENT_ACCOUNT_DEACTIVATED', target_type: 'PAYMENT_ACCOUNT', target_id: id, after_state: data })
  revalidatePath('/admin/accounts')
  revalidatePath('/admin')
  return data
}
