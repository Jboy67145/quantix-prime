'use server'

import { and, asc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { deposits, paymentAccounts, plans, user } from '@/lib/db/schema'

async function getUserId() {
  const session = await auth.getSession()
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getPublicPlans() { return db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.displayOrder)) }
export async function getPaymentAccounts() { return db.select().from(paymentAccounts).where(eq(paymentAccounts.active, true)).orderBy(asc(paymentAccounts.displayOrder)) }

const proofSchema = z.object({ planId: z.string().uuid(), paymentAccountId: z.string().uuid(), amountMinor: z.number().int().positive(), transferReference: z.string().trim().min(4).max(80), proofName: z.string().trim().min(1).max(160) })
export async function submitInvestmentProof(input: z.input<typeof proofSchema>) {
  const userId = await getUserId(); const data = proofSchema.parse(input)
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, data.planId), eq(plans.active, true))).limit(1)
  const [account] = await db.select().from(paymentAccounts).where(and(eq(paymentAccounts.id, data.paymentAccountId), eq(paymentAccounts.active, true))).limit(1)
  if (!plan || !account || data.amountMinor < plan.minimumMinor || data.amountMinor > plan.maximumMinor) throw new Error('Invalid plan, account, or amount')
  const [deposit] = await db.insert(deposits).values({ userId, planId: plan.id, paymentAccountId: account.id, amountMinor: data.amountMinor, transferReference: data.transferReference, paymentProofName: data.proofName, status: 'PENDING' }).returning()
  revalidatePath('/'); return deposit
}

async function requireAdmin() {
  const session = await auth.getSession(); if (!session?.user) throw new Error('Unauthorized')
  const [record] = await db.select({ role: user.role }).from(user).where(eq(user.id, session.user.id)).limit(1)
  if (record?.role !== 'ADMIN') throw new Error('Forbidden')
}
export async function getAdminPaymentAccounts() { await requireAdmin(); return db.select().from(paymentAccounts).orderBy(asc(paymentAccounts.displayOrder)) }

const accountSchema = z.object({ label: z.string().trim().min(2).max(60), bankName: z.string().trim().min(2).max(80), accountName: z.string().trim().min(2).max(120), accountNumber: z.string().regex(/^\d{10}$/) })
export async function createPaymentAccount(input: z.input<typeof accountSchema>) { await requireAdmin(); const data = accountSchema.parse(input); const [account] = await db.insert(paymentAccounts).values(data).returning(); revalidatePath('/admin'); return account }
