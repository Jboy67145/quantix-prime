'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

async function getUserId() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

async function getOptionalUserId() {
  const user = await getCurrentUser()
  return user?.id ?? null
}

export async function getWallet() {
  const userId = await getUserId()
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_wallets').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error('Unable to load wallet')
  if (data) return data
  const { data: created, error: createError } = await supabase.from('quantix_wallets').insert({ user_id: userId }).select().single()
  if (createError) throw new Error('Unable to create wallet')
  return created
}

export async function getLedger(limit = 20) {
  const userId = await getUserId()
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_ledger_entries').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(Math.min(Math.max(limit, 1), 50))
  if (error) throw new Error('Unable to load ledger')
  return data ?? []
}

const depositSchema = z.object({ amountMinor: z.number().int().positive().max(100_000_000_000), senderName: z.string().trim().min(2).max(120), transferReference: z.string().trim().min(4).max(120) })
export async function submitDeposit(input: z.input<typeof depositSchema>) {
  const userId = await getUserId()
  const data = depositSchema.parse(input)
  const supabase = await createClient()
  const { data: deposit, error } = await supabase.from('quantix_deposits').insert({ user_id: userId, amount_minor: data.amountMinor, sender_name: data.senderName, transfer_reference: data.transferReference }).select().single()
  if (error) throw new Error('Unable to submit deposit')
  revalidatePath('/')
  return deposit
}

const withdrawalSchema = z.object({ amountMinor: z.number().int().positive().max(100_000_000_000), payoutAccountId: z.string().uuid() })
export async function submitWithdrawal(input: z.input<typeof withdrawalSchema>) {
  const userId = await getUserId()
  const data = withdrawalSchema.parse(input)
  const supabase = await createClient()
  const { data: wallet } = await supabase.from('quantix_wallets').select('*').eq('user_id', userId).maybeSingle()
  const { data: account } = await supabase.from('quantix_payout_accounts').select('*').eq('id', data.payoutAccountId).eq('user_id', userId).maybeSingle()
  if (!wallet || wallet.available_minor < data.amountMinor) throw new Error('Insufficient available balance')
  if (!account) throw new Error('Payout account not found')
  const feeMinor = Math.round(data.amountMinor * 0.01)
  const { data: withdrawal, error } = await supabase.from('quantix_withdrawals').insert({ user_id: userId, payout_account_id: account.id, amount_minor: data.amountMinor, fee_minor: feeMinor, net_minor: data.amountMinor - feeMinor, payout_account_snapshot: account }).select().single()
  if (error) throw new Error('Unable to submit withdrawal')
  const { error: updateError } = await supabase.from('quantix_wallets').update({ available_minor: wallet.available_minor - data.amountMinor, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('available_minor', wallet.available_minor)
  if (updateError) throw new Error('Unable to reserve withdrawal balance')
  revalidatePath('/')
  return withdrawal
}
