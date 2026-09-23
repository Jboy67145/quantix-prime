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
  ['Starter Prime', 'DAILY', 1000000, 1150000, 100000, 3],
  ['Mini Growth', 'DAILY', 1500000, 1800000, 150000, 5],
  ['Bronze Growth', 'WEEKLY', 2500000, 3125000, 250000, 7],
  ['Pioneer Vault', 'WEEKLY', 3500000, 4620000, 350000, 10],
  ['Silver Vault', 'WEEKLY', 5000000, 7000000, 500000, 14],
  ['Pro Vault', 'WEEKLY', 7500000, 11625000, 750000, 20],
  ['Gold Vault', 'MONTHLY', 10000000, 18000000, 1000000, 30],
  ['Master Growth', 'MONTHLY', 15000000, 29250000, 1500000, 35],
  ['Platinum Vault', 'MONTHLY', 25000000, 56250000, 2000000, 45],
  ['Diamond Executive', 'MONTHLY', 50000000, 150000000, 3500000, 60],
  ['Titan Executive', 'MONTHLY', 75000000, 285000000, 4250000, 75],
  ['Apex Prime', 'MONTHLY', 100000000, 450000000, 5000000, 90],
] as const
const fallbackPlans = STANDARD_PLANS.map((p, index) => { const profit = p[3] - p[2]; return { id: `00000000-0000-0000-0000-${String(index + 11).padStart(12, '0')}`, name: p[0], description: `${p[0]} investment plan`, category: p[1], minimumMinor: p[2], maximumMinor: p[2], totalEarningsMinor: p[3], dailyEarningsMinor: Math.round(profit / p[5]), durationDays: p[5], purchaseBonusMinor: p[4], status: 'OPEN', returnBps: Math.round((profit / p[2]) * 10000), displayOrder: index + 1 } })

export async function getPublicPlans() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_plans').select('*').eq('active', true).order('display_order', { ascending: true })
  if (error || !data?.length) return fallbackPlans
  return data.map((plan: any) => { const profit = Math.round(Number(plan.minimum_minor) * Number(plan.return_bps || 0) / 10000); return { ...plan, minimumMinor: Number(plan.minimum_minor), maximumMinor: Number(plan.maximum_minor), durationDays: Number(plan.duration_days), totalEarningsMinor: Number(plan.minimum_minor) + profit, dailyEarningsMinor: Math.round(profit / Number(plan.duration_days)), purchaseBonusMinor: Number(plan.purchase_bonus_minor || 0), status: plan.active ? 'OPEN' : 'CLOSED' } })
}

const FUNDING_ACCOUNTS = [
  { id: '00000000-0000-0000-0000-000000000001', bank_name: 'OPay', account_number: '6416814256', account_name: 'JAPHET JOHN', label: 'OPay · JAPHET JOHN', active: true, display_order: 1 },
  { id: '00000000-0000-0000-0000-000000000002', bank_name: 'PalmPay', account_number: '8903977964', account_name: 'JAPHET JOHN', label: 'PalmPay · JAPHET JOHN', active: true, display_order: 2 },
  { id: '00000000-0000-0000-0000-000000000003', bank_name: 'Fairmoney', account_number: '2004889299', account_name: 'JAPHET JOHN', label: 'Fairmoney · JAPHET JOHN', active: true, display_order: 3 },
]

export async function getPaymentAccounts() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_payment_accounts').select('*').eq('active', true).order('display_order', { ascending: true })
  if (error || !data?.length) return FUNDING_ACCOUNTS
  return data
}

const purchaseSchema = z.object({ planId: z.string().uuid() })

export async function purchaseInvestment(input: z.input<typeof purchaseSchema>) {
  const userId = await getUserId()
  const { planId } = purchaseSchema.parse(input)
  const supabase = await createClient()
  const { data: storedPlan, error: planError } = await supabase.from('quantix_plans').select('*').eq('id', planId).eq('active', true).maybeSingle()
  if (planError || !storedPlan) throw new Error('This investment plan is unavailable. Please refresh and try again.')
  const selected = { ...storedPlan, total_earnings_minor: Number(storedPlan.minimum_minor) + Math.round(Number(storedPlan.minimum_minor) * Number(storedPlan.return_bps || 0) / 10000), purchase_bonus_minor: Number(storedPlan.purchase_bonus_minor || 0) }
  const principal = Number(selected.minimum_minor)
  const { data: wallet } = await supabase.from('quantix_wallets').select('*').eq('user_id', userId).maybeSingle()
  if (!wallet || Number(wallet.available_minor) < principal) throw new Error('Insufficient wallet balance. Please deposit funds before investing.')
  const now = new Date()
  const maturesAt = new Date(now.getTime() + Number(selected.duration_days) * 86400000)
  const { data: investment, error } = await supabase.from('quantix_investments').insert({ user_id: userId, plan_id: planId, principal_minor: principal, profit_minor: Number(selected.total_earnings_minor) - principal, maturity_minor: Number(selected.total_earnings_minor), duration_days_snapshot: Number(selected.duration_days), return_bps_snapshot: Number(selected.return_bps || 0), plan_name_snapshot: selected.name, started_at: now.toISOString(), matures_at: maturesAt.toISOString(), status: 'ACTIVE' }).select().single()
  if (error) throw new Error('Unable to create investment')
  const newAvailable = Number(wallet.available_minor) - principal
  const { data: reserved } = await supabase.from('quantix_wallets').update({ available_minor: newAvailable, invested_minor: Number(wallet.invested_minor || 0) + principal, updated_at: now.toISOString() }).eq('user_id', userId).eq('available_minor', wallet.available_minor).select('user_id').maybeSingle()
  if (!reserved) { await supabase.from('quantix_investments').delete().eq('id', investment.id); throw new Error('Insufficient wallet balance. Please try again.') }
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
