'use server'

import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { investments, plans, referrals, supportMessages, supportThreads, wallets } from '@/lib/db/schema'

async function getUserId() { const session = await auth.api.getSession({ headers: await headers() }); if (!session?.user) throw new Error('Unauthorized'); return session.user.id }

export async function getActivePlans() { return db.select().from(plans).where(eq(plans.active, true)).orderBy(plans.displayOrder) }
export async function getInvestments() { const userId = await getUserId(); return db.select().from(investments).where(eq(investments.userId, userId)).orderBy(desc(investments.startedAt)) }

const investSchema = z.object({ planId: z.string().uuid(), amountMinor: z.number().int().positive() })
export async function createInvestment(input: z.input<typeof investSchema>) {
  const userId = await getUserId(); const data = investSchema.parse(input)
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, data.planId), eq(plans.active, true))).limit(1)
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
  if (!plan || !wallet || data.amountMinor < plan.minimumMinor || data.amountMinor > plan.maximumMinor || wallet.availableMinor < data.amountMinor) throw new Error('Investment eligibility check failed')
  const profitMinor = Math.round(data.amountMinor * plan.returnBps / 10000); const maturesAt = new Date(Date.now() + plan.durationDays * 86400000)
  const [investment] = await db.insert(investments).values({ userId, planId: plan.id, planNameSnapshot: plan.name, principalMinor: data.amountMinor, returnBpsSnapshot: plan.returnBps, profitMinor, maturityMinor: data.amountMinor + profitMinor, durationDaysSnapshot: plan.durationDays, maturesAt }).returning()
  await db.update(wallets).set({ availableMinor: wallet.availableMinor - data.amountMinor, investedMinor: wallet.investedMinor + data.amountMinor, updatedAt: new Date() }).where(and(eq(wallets.userId, userId), eq(wallets.availableMinor, wallet.availableMinor)))
  revalidatePath('/'); return investment
}

export async function getReferralSummary() { const userId = await getUserId(); return db.select().from(referrals).where(eq(referrals.referrerUserId, userId)).orderBy(desc(referrals.createdAt)) }
export async function getSupportThreads() { const userId = await getUserId(); return db.select().from(supportThreads).where(eq(supportThreads.userId, userId)).orderBy(desc(supportThreads.updatedAt)) }
const supportSchema = z.object({ subject: z.string().trim().min(3).max(100), body: z.string().trim().min(1).max(2000) })
export async function createSupportThread(input: z.input<typeof supportSchema>) { const userId = await getUserId(); const data = supportSchema.parse(input); const [thread] = await db.insert(supportThreads).values({ userId, subject: data.subject }).returning(); await db.insert(supportMessages).values({ threadId: thread.id, userId, body: data.body, senderType: 'USER' }); revalidatePath('/'); return thread }
