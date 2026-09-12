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
  if (error) return []
  return data ?? []
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
