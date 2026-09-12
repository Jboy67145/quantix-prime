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

export async function getWalletSnapshot() {
  const userId = await getUserId()
  const supabase = await createClient()
  const [{ data: wallet }, { data: ledger }, { data: active }] = await Promise.all([
    supabase.from('quantix_wallets').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('quantix_ledger_entries').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(12),
    supabase.from('quantix_investments').select('*').eq('user_id', userId).eq('status', 'ACTIVE'),
  ])
  const entries = ledger ?? []
  const credits = entries.filter((entry) => entry.direction === 'CREDIT').reduce((sum, entry) => sum + Number(entry.amount_minor), 0)
  const debits = entries.filter((entry) => entry.direction === 'DEBIT').reduce((sum, entry) => sum + Number(entry.amount_minor), 0)
  return { wallet, ledger: entries, active: active ?? [], trendPercent: credits ? Math.round(((credits - debits) / credits) * 100) : 0 }
}

export async function getInvestedPlanIds() {
  const userId = await getUserId()
  const supabase = await createClient()
  const { data } = await supabase.from('quantix_investments').select('plan_id').eq('user_id', userId)
  return (data ?? []).map((row) => row.plan_id)
}

export async function processMaturities() {
  const supabase = await createClient()
  const { data: due } = await supabase.from('quantix_investments').select('*').eq('status', 'ACTIVE').lte('matures_at', new Date().toISOString())
  for (const investment of due ?? []) {
    const { data: updated } = await supabase.from('quantix_investments').update({ status: 'MATURED', matured_at: new Date().toISOString() }).eq('id', investment.id).eq('status', 'ACTIVE').select('id').maybeSingle()
    if (!updated) continue
    await supabase.from('quantix_ledger_entries').upsert({ user_id: investment.user_id, reference: `maturity:${investment.id}`, type: 'MATURITY_PAYOUT', amount_minor: investment.maturity_minor, direction: 'CREDIT', metadata: { investmentId: investment.id } }, { onConflict: 'reference', ignoreDuplicates: true })
    const { data: wallet } = await supabase.from('quantix_wallets').select('available_minor, invested_minor, profit_minor').eq('user_id', investment.user_id).maybeSingle()
    if (wallet) await supabase.from('quantix_wallets').update({ available_minor: Number(wallet.available_minor) + Number(investment.maturity_minor), profit_minor: Number(wallet.profit_minor) + Number(investment.profit_minor), invested_minor: Number(wallet.invested_minor) - Number(investment.principal_minor), updated_at: new Date().toISOString() }).eq('user_id', investment.user_id)
  }
  revalidatePath('/')
  return due?.length ?? 0
}

export async function getReferralSnapshot() {
  const userId = await getUserId()
  const supabase = await createClient()
  const [{ data: profile }, { data: referrals }] = await Promise.all([
    supabase.from('profiles').select('username, invite_code').eq('id', userId).maybeSingle(),
    supabase.from('quantix_referrals').select('*').eq('referrer_user_id', userId).order('created_at', { ascending: false }),
  ])
  const rows = referrals ?? []
  return { profile, referrals: rows, earned: rows.filter((row) => row.status === 'QUALIFIED').reduce((sum, row) => sum + Number(row.reward_minor), 0), pending: rows.filter((row) => row.status !== 'QUALIFIED').reduce((sum, row) => sum + Number(row.reward_minor), 0), link: profile?.invite_code ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/sign-up?ref=${profile.invite_code}` : '' }
}

const payoutSchema = z.object({ bankName: z.string().trim().min(2).max(80), accountName: z.string().trim().min(2).max(120), accountNumber: z.string().regex(/^\d{10}$/) })
export async function addPayoutAccount(input: z.input<typeof payoutSchema>) {
  const userId = await getUserId()
  const data = payoutSchema.parse(input)
  const supabase = await createClient()
  const { count } = await supabase.from('quantix_payout_accounts').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if ((count ?? 0) >= 2) throw new Error('You can save up to two payout accounts')
  const { data: account, error } = await supabase.from('quantix_payout_accounts').insert({ user_id: userId, bank_name: data.bankName, account_name: data.accountName, account_number: data.accountNumber, is_default: (count ?? 0) === 0 }).select().single()
  if (error) throw new Error('Unable to save payout account')
  revalidatePath('/')
  return account
}

export async function getUserPayoutAccounts() {
  const userId = await getUserId()
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_payout_accounts').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw new Error('Unable to load payout accounts')
  return data ?? []
}

export async function requestWithdrawal(input: { payoutAccountId: string; amountMinor: number }) {
  const userId = await getUserId()
  const data = z.object({ payoutAccountId: z.string().uuid(), amountMinor: z.number().int().positive() }).parse(input)
  const supabase = await createClient()
  const { data: settings } = await supabase.from('quantix_withdrawal_settings').select('*').limit(1).maybeSingle()
  if (settings?.enabled && data.amountMinor < Number(settings.minimum_minor)) throw new Error('Amount is outside the configured withdrawal limits')
  const { data: wallet } = await supabase.from('quantix_wallets').select('*').eq('user_id', userId).maybeSingle()
  const { data: account } = await supabase.from('quantix_payout_accounts').select('*').eq('id', data.payoutAccountId).eq('user_id', userId).maybeSingle()
  if (!wallet || Number(wallet.available_minor) < data.amountMinor) throw new Error('Insufficient wallet balance')
  if (!account) throw new Error('Payout account not found')
  const feeMinor = Math.round(data.amountMinor * 0.01)
  const { data: request, error } = await supabase.from('quantix_withdrawals').insert({ user_id: userId, payout_account_id: account.id, amount_minor: data.amountMinor, fee_minor: feeMinor, net_minor: data.amountMinor - feeMinor, payout_account_snapshot: account }).select().single()
  if (error) throw new Error('Unable to submit withdrawal')
  await supabase.from('quantix_wallets').update({ available_minor: Number(wallet.available_minor) - data.amountMinor, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('available_minor', wallet.available_minor)
  revalidatePath('/')
  return request
}
