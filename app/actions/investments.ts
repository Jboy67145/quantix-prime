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

const FALLBACK_PLANS = [
  ['Starter Prime', 1000000, 3, 100000, 1500], ['Mini Growth', 1500000, 5, 150000, 2000], ['Bronze Growth', 2500000, 7, 250000, 2500], ['Pioneer Vault', 3500000, 10, 350000, 3200],
  ['Silver Vault', 5000000, 14, 500000, 4000], ['Pro Vault', 7500000, 20, 750000, 5500], ['Gold Vault', 10000000, 30, 1000000, 8000], ['Master Growth', 15000000, 35, 1500000, 9500],
  ['Platinum Vault', 25000000, 45, 2000000, 12500], ['Diamond Executive', 50000000, 60, 3500000, 20000], ['Titan Executive', 75000000, 75, 4250000, 28000], ['Apex Prime', 100000000, 90, 5000000, 35000],
].map(([name, minimumMinor, durationDays, purchaseBonusMinor, returnBps], index) => ({ id: `00000000-0000-0000-0000-${String(index + 11).padStart(12, '0')}`, name, description: `${name} investment plan`, category: Number(durationDays) <= 5 ? 'DAILY' : Number(durationDays) <= 20 ? 'WEEKLY' : 'MONTHLY', minimumMinor, maximumMinor: minimumMinor, durationDays, purchaseBonusMinor, returnBps, active: true, displayOrder: index + 1 }))

export async function getPublicPlans() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_plans').select('*').eq('active', true).order('display_order', { ascending: true })
  const plans = error || !data?.length ? FALLBACK_PLANS : data
  return plans.map((plan: any) => { const profit = Math.round(Number(plan.minimum_minor ?? plan.minimumMinor) * Number(plan.return_bps ?? plan.returnBps ?? 0) / 10000); return { ...plan, minimumMinor: Number(plan.minimum_minor ?? plan.minimumMinor), maximumMinor: Number(plan.maximum_minor ?? plan.maximumMinor), durationDays: Number(plan.duration_days ?? plan.durationDays), totalEarningsMinor: Number(plan.minimum_minor ?? plan.minimumMinor) + profit, dailyEarningsMinor: Math.round(profit / Number(plan.duration_days ?? plan.durationDays)), purchaseBonusMinor: Number(plan.purchase_bonus_minor ?? plan.purchaseBonusMinor ?? 0), status: 'OPEN' } })
}

export async function getPaymentAccounts() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_payment_accounts').select('*').eq('active', true).order('display_order', { ascending: true })
  if (error) throw new Error('Unable to load deposit accounts.')
  if (!data?.length) return []
  return data
}

const purchaseSchema = z.object({ planId: z.string().uuid() })

export async function purchaseInvestment(input: z.input<typeof purchaseSchema>) {
  await getUserId()
  const { planId } = purchaseSchema.parse(input)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('purchase_investment_atomic', { p_plan_id: planId })
  if (error || !data) {
    const message = error?.message?.toLowerCase() || ''
    if (message.includes('insufficient') || message.includes('balance') || message.includes('fund')) throw new Error('Insufficient available balance for this investment.')
    if (message.includes('plan') || message.includes('active')) throw new Error('This investment plan is no longer available. Please choose another plan.')
    throw new Error('Unable to complete this investment right now. Please try again.')
  }
  revalidatePath('/')
  return data
}

export async function getUserInvestments() {
  const user = await getCurrentUser()
  if (!user) return []
  const userId = user.id
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_investments').select('*').eq('user_id', userId).order('started_at', { ascending: false })
  if (error) throw new Error('Unable to load your investments.')
  return data ?? []
}
