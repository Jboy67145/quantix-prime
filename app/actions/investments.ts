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
  ['Quantix Swift 3', 'DAILY', 350000, 350000, 450000, 1500, 3, 500, 'OPEN'],
  ['Quantix Swift 4', 'DAILY', 500000, 500000, 700000, 1750, 4, 750, 'LOCKED'],
  ['Quantix Swift 5', 'DAILY', 750000, 750000, 1050000, 2100, 5, 1000, 'LOCKED'],
  ['Quantix Swift 6', 'DAILY', 1000000, 1000000, 1500000, 2500, 6, 1500, 'LOCKED'],
  ['Quantix Growth 1', 'WEEKLY', 1500000, 1500000, 2100000, 3000, 7, 2000, 'LOCKED'],
  ['Quantix Growth 2', 'WEEKLY', 3000000, 3000000, 5600000, 4000, 14, 3500, 'LOCKED'],
  ['Quantix Growth 3', 'WEEKLY', 5000000, 5000000, 11550000, 5500, 21, 5000, 'LOCKED'],
  ['Quantix Prime 1', 'MONTHLY', 7500000, 7500000, 24000000, 8000, 30, 7500, 'LOCKED'],
  ['Quantix Prime 2', 'MONTHLY', 12500000, 12500000, 72000000, 12000, 60, 12500, 'LOCKED'],
  ['Quantix Prime 3', 'MONTHLY', 20000000, 20000000, 148500000, 16500, 90, 20000, 'LOCKED'],
  ['Quantix Prime 4', 'MONTHLY', 30000000, 30000000, 258000000, 21500, 120, 30000, 'LOCKED'],
  ['Quantix Prime 5', 'MONTHLY', 50000000, 50000000, 400000000, 26666.67, 150, 50000, 'LOCKED'],
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
