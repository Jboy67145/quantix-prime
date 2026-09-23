'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/env'
import { createUserNotification } from '@/app/actions/notifications'

async function getUserId() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

async function getOptionalUserId() {
  const user = await getCurrentUser()
  return user?.id ?? null
}

export async function getWalletSnapshot() {
  const userId = await getOptionalUserId()
  if (!userId) return { wallet: null, ledger: [], active: [], trendPercent: 0 }
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
  const userId = await getOptionalUserId()
  if (!userId) return []
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
    if (wallet) await supabase.from('quantix_wallets').update({ available_minor: Number(wallet.available_minor) + Number(investment.maturity_minor), profit_minor: Number(wallet.profit_minor) + Number(investment.profit_minor), invested_minor: Math.max(0, Number(wallet.invested_minor) - Number(investment.principal_minor)), updated_at: new Date().toISOString() }).eq('user_id', investment.user_id).eq('available_minor', wallet.available_minor).eq('invested_minor', wallet.invested_minor)
  }
  revalidatePath('/')
  return due?.length ?? 0
}

export async function getReferralSnapshot() {
  const userId = await getOptionalUserId()
  if (!userId) return { profile: null, referrals: [], earned: 0, pending: 0, link: '' }
  const supabase = await createClient()
  const [{ data: profile }, { data: referrals }] = await Promise.all([
    supabase.from('profiles').select('username, invite_code').eq('id', userId).maybeSingle(),
    supabase.from('quantix_referrals').select('*').eq('referrer_user_id', userId).order('created_at', { ascending: false }),
  ])
  const rows = referrals ?? []
  return { profile, referrals: rows, earned: rows.filter((row) => row.status === 'QUALIFIED').reduce((sum, row) => sum + Number(row.reward_minor), 0), pending: rows.filter((row) => row.status !== 'QUALIFIED').reduce((sum, row) => sum + Number(row.reward_minor), 0), link: profile?.username ? `${getAppUrl()}/sign-up?ref=${encodeURIComponent(profile.username)}` : '' }
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
  const parsed = z.object({
    payoutAccountId: z.string().uuid(),
    amountMinor: z.number().int().positive('Withdrawal amount must be greater than ₦0.'),
  }).safeParse(input)
  if (!parsed.success) throw new Error('Enter a valid withdrawal amount.')
  const data = parsed.data
  const supabase = await createClient()

  const { data: settings, error: settingsError } = await supabase
    .from('quantix_withdrawal_settings')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (settingsError) throw new Error('Unable to load withdrawal settings.')
  if (settings?.enabled && data.amountMinor < Number(settings.minimum_minor)) {
    throw new Error(`Minimum withdrawal amount is ${moneyMinor(Number(settings.minimum_minor))}.`)
  }
  if (settings?.enabled && settings.maximum_minor && data.amountMinor > Number(settings.maximum_minor)) {
    throw new Error(`Maximum withdrawal amount is ${moneyMinor(Number(settings.maximum_minor))}.`)
  }

  const { data: request, error } = await supabase.rpc('request_withdrawal_atomic', {
    p_payout_account_id: data.payoutAccountId,
    p_amount_minor: data.amountMinor,
  })
  if (error || !request) {
    throw new Error(error?.message || 'We could not process your withdrawal right now. Please try again.')
  }

  await createUserNotification({
    userId,
    title: 'Withdrawal submitted',
    body: `Your withdrawal request for ${moneyMinor(data.amountMinor)} is pending admin processing.`,
    type: 'WITHDRAWAL',
  })
  revalidatePath('/')
  return request
}

function moneyMinor(minor: number) { return `₦${(minor / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export async function uploadDepositProof(file: File) {
  const userId = await getUserId()
  if (!file || file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) throw new Error('Upload a JPG, PNG, or PDF proof under 5MB')
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const safeName = `${crypto.randomUUID()}.${extension}`
  const path = `${userId}/${safeName}`
  const supabase = await createClient()
  const { error } = await supabase.storage.from('deposit-proofs').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error('Unable to upload payment proof. Please try again.')
  return path
}

const walletDepositSchema = z.object({ amountMinor: z.number().int().positive().max(100_000_000_000), paymentAccountId: z.string().uuid(), transferReference: z.string().trim().min(4).max(120), senderName: z.string().trim().min(2).max(120), proofPathname: z.string().trim().min(1).max(500) })

export async function submitWalletDeposit(input: z.input<typeof walletDepositSchema>) {
  const userId = await getUserId()
  const data = walletDepositSchema.parse(input)
  const supabase = await createClient()
  const { data: account, error: accountError } = await supabase.from('quantix_payment_accounts').select('id').eq('id', data.paymentAccountId).eq('active', true).maybeSingle()
  if (accountError || !account) throw new Error('Funding account is not available. Please refresh and select an active account.')
  const { data: deposit, error } = await supabase.from('quantix_deposits').insert({ user_id: userId, amount_minor: data.amountMinor, payment_account_id: data.paymentAccountId, transfer_reference: data.transferReference, sender_name: data.senderName, proof_url: data.proofPathname, payment_proof_name: data.proofPathname.split('/').pop(), status: 'PENDING' }).select().single()
  if (error) {
    await supabase.storage.from('deposit-proofs').remove([data.proofPathname])
    throw new Error('Unable to submit deposit proof')
  }
  revalidatePath('/')
  return deposit
}

export async function getWalletDetails() {
  const userId = await getUserId()
  const supabase = await createClient()
  const [walletResult, depositsResult, withdrawalsResult, accountsResult] = await Promise.all([
    supabase.from('quantix_wallets').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('quantix_deposits').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('quantix_withdrawals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('quantix_payout_accounts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  const failed = [walletResult.error, depositsResult.error, withdrawalsResult.error, accountsResult.error].find(Boolean)
  if (failed) throw new Error(`Unable to load wallet data: ${failed.message}`)
  return { wallet: walletResult.data, deposits: depositsResult.data ?? [], withdrawals: withdrawalsResult.data ?? [], accounts: accountsResult.data ?? [] }
}
