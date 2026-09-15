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

const STANDARD_PLANS = [
  ['Quantix Swift Plan 1', 'DAILY', 1000000, 1000000, 1150000, 50000, 3, 100000, 'OPEN'],
  ['Quantix Swift Plan 2', 'DAILY', 2000000, 2000000, 2400000, 80000, 5, 200000, 'OPEN'],
  ['Quantix Swift Plan 3', 'WEEKLY', 3500000, 3500000, 4300000, 114286, 7, 350000, 'OPEN'],
  ['Quantix Swift Plan 4', 'WEEKLY', 5000000, 5000000, 6500000, 150000, 10, 500000, 'OPEN'],
  ['Quantix Prime Plan 1', 'WEEKLY', 7500000, 7500000, 10500000, 214286, 14, 750000, 'OPEN'],
  ['Quantix Prime Plan 2', 'WEEKLY', 10000000, 10000000, 15000000, 238095, 21, 1000000, 'OPEN'],
  ['Quantix Prime Plan 3', 'MONTHLY', 15000000, 15000000, 25000000, 333333, 30, 1500000, 'OPEN'],
  ['Quantix Prime Plan 4', 'MONTHLY', 25000000, 25000000, 50000000, 714286, 35, 2500000, 'OPEN'],
  ['Quantix Prime Plan 5', 'MONTHLY', 35000000, 35000000, 80000000, 1125000, 40, 3000000, 'OPEN'],
  ['Quantix Elite Plan 1', 'MONTHLY', 50000000, 50000000, 135000000, 1888889, 45, 3500000, 'OPEN'],
  ['Quantix Elite Plan 2', 'MONTHLY', 75000000, 75000000, 255000000, 3461538, 52, 4000000, 'OPEN'],
  ['Quantix Elite Max', 'MONTHLY', 100000000, 100000000, 450000000, 5833333, 60, 5000000, 'OPEN'],
] as const
const fallbackPlans = STANDARD_PLANS.map((p, index) => ({ id: `00000000-0000-0000-0000-${String(index + 11).padStart(12, '0')}`, name: p[0], description: `${p[1] === 'DAILY' ? 'Daily' : p[1] === 'WEEKLY' ? 'Weekly' : 'Monthly'} earnings plan`, category: p[1], minimumMinor: p[2], maximumMinor: p[3], totalEarningsMinor: p[4], dailyEarningsMinor: Math.round(p[5] * 100), durationDays: p[6], purchaseBonusMinor: p[7] * 100, status: p[8], returnBps: 0 }))

export async function getPublicPlans() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_plans').select('*').eq('active', true).order('display_order', { ascending: true })
  if (error || !data?.length) return fallbackPlans
  return data.map((plan: any) => ({ ...plan, minimumMinor: plan.minimum_minor, maximumMinor: plan.maximum_minor, durationDays: plan.duration_days, totalEarningsMinor: plan.total_earnings_minor, dailyEarningsMinor: plan.daily_earnings_minor, purchaseBonusMinor: plan.purchase_bonus_minor, status: plan.status || 'OPEN' }))
}

const FUNDING_ACCOUNTS = [
  { id: '00000000-0000-0000-0000-000000000001', bank_name: 'OPay', account_number: '6416814256', account_name: 'JAPHET JOHN', label: 'OPay · JAPHET JOHN', active: true, display_order: 1 },
  { id: '00000000-0000-0000-0000-000000000002', bank_name: 'PalmPay', account_number: '8903977964', account_name: 'JAPHET JOHN', label: 'PalmPay · JAPHET JOHN', active: true, display_order: 2 },
  { id: '00000000-0000-0000-0000-000000000003', bank_name: 'Fairmoney', account_number: '2004889299', account_name: 'JAPHET JOHN', label: 'Fairmoney · JAPHET JOHN', active: true, display_order: 3 },
]

export async function getPaymentAccounts() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_payment_accounts').select('*').eq('active', true).order('display_order', { ascending: true })
  if (!error && data?.length) return data
  return FUNDING_ACCOUNTS
}

const purchaseSchema = z.object({ planId: z.string().uuid() })

export async function purchaseInvestment(input: z.input<typeof purchaseSchema>) {
  const userId = await getUserId()
  const { planId } = purchaseSchema.parse(input)
  const plan = fallbackPlans.find((item) => item.id === planId)
  const supabase = await createClient()
  const { data: storedPlan } = await supabase.from('quantix_plans').select('*').eq('id', planId).eq('active', true).maybeSingle()
  const selected = storedPlan ? { ...storedPlan, minimum_minor: storedPlan.minimum_minor, duration_days: storedPlan.duration_days, total_earnings_minor: storedPlan.total_earnings_minor, purchase_bonus_minor: storedPlan.purchase_bonus_minor } : plan
  if (!selected) throw new Error('Investment plan not found')
  const principal = Number(selected.minimum_minor)
  const { data: wallet } = await supabase.from('quantix_wallets').select('*').eq('user_id', userId).maybeSingle()
  if (!wallet || Number(wallet.available_minor) < principal) throw new Error('Insufficient wallet balance. Please deposit funds before investing.')
  const now = new Date()
  const maturesAt = new Date(now.getTime() + Number(selected.duration_days) * 86400000)
  const { data: investment, error } = await supabase.from('quantix_investments').insert({ user_id: userId, plan_id: planId, principal_minor: principal, profit_minor: Number(selected.total_earnings_minor) - principal, bonus_minor: Number(selected.purchase_bonus_minor || 0), maturity_minor: Number(selected.total_earnings_minor), started_at: now.toISOString(), matures_at: maturesAt.toISOString(), status: 'ACTIVE' }).select().single()
  if (error) throw new Error('Unable to create investment')
  const newAvailable = Number(wallet.available_minor) - principal + Number(selected.purchase_bonus_minor || 0)
  await supabase.from('quantix_wallets').update({ available_minor: newAvailable, invested_minor: Number(wallet.invested_minor || 0) + principal, updated_at: now.toISOString() }).eq('user_id', userId).eq('available_minor', wallet.available_minor)
  await supabase.from('quantix_ledger_entries').insert([
    { user_id: userId, amount_minor: principal, direction: 'DEBIT', type: 'INVESTMENT_PURCHASE', reference: `INV-${investment.id}`, status: 'POSTED', metadata: { investmentId: investment.id, planId } },
    { user_id: userId, amount_minor: Number(selected.purchase_bonus_minor || 0), direction: 'CREDIT', type: 'PURCHASE_BONUS', reference: `BON-${investment.id}`, status: 'POSTED', metadata: { investmentId: investment.id } },
  ])
  revalidatePath('/')
  return investment
}

const proofSchema = z.object({ planId: z.string().uuid(), paymentAccountId: z.string().uuid(), amountMinor: z.number().int().positive(), transferReference: z.string().trim().min(4).max(80), proofName: z.string().trim().min(1).max(160) })
export async function submitInvestmentProof(input: z.input<typeof proofSchema>) {
  const userId = await getUserId()
  const data = proofSchema.parse(input)
  const supabase = await createClient()
  const { data: plan } = await supabase.from('quantix_plans').select('*').eq('id', data.planId).eq('active', true).maybeSingle()
  const { data: account } = await supabase.from('quantix_payment_accounts').select('*').eq('id', data.paymentAccountId).eq('active', true).maybeSingle()
  if (!plan || !account || data.amountMinor < plan.minimum_minor || data.amountMinor > plan.maximum_minor) throw new Error('Invalid plan, account, or amount')
  const { data: deposit, error } = await supabase.from('quantix_deposits').insert({ user_id: userId, plan_id: plan.id, payment_account_id: account.id, amount_minor: data.amountMinor, transfer_reference: data.transferReference, payment_proof_name: data.proofName, status: 'PENDING' }).select().single()
  if (error) throw new Error('Unable to submit investment proof')
  revalidatePath('/')
  return deposit
}
