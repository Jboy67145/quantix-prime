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

export async function getPublicPlans() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_plans').select('*').eq('active', true).order('display_order', { ascending: true })
  if (error) throw new Error('Unable to load investment plans.')
  if (!data?.length) return []
  return data.map((plan: any) => { const profit = Math.round(Number(plan.minimum_minor) * Number(plan.return_bps || 0) / 10000); return { ...plan, minimumMinor: Number(plan.minimum_minor), maximumMinor: Number(plan.maximum_minor), durationDays: Number(plan.duration_days), totalEarningsMinor: Number(plan.minimum_minor) + profit, dailyEarningsMinor: Math.round(profit / Number(plan.duration_days)), purchaseBonusMinor: Number(plan.purchase_bonus_minor || 0), status: plan.active ? 'OPEN' : 'CLOSED' } })
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
  if (error || !data) throw new Error(error?.message || 'Unable to purchase investment. Please try again.')
  revalidatePath('/')
  return data
}

export async function getUserInvestments() {
  const userId = await getUserId()
  const supabase = await createClient()
  const { data, error } = await supabase.from('quantix_investments').select('*').eq('user_id', userId).order('started_at', { ascending: false })
  if (error) throw new Error('Unable to load your investments.')
  return data ?? []
}
