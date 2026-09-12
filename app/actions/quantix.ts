'use server'

import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { deposits, ledgerEntries, payoutAccounts, wallets, withdrawals } from '@/lib/db/schema'

async function getUserId() {
  const session = await auth.getSession()
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getWallet() {
  const userId = await getUserId()
  const existing = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
  if (existing[0]) return existing[0]
  const [created] = await db.insert(wallets).values({ userId }).returning()
  return created
}

export async function getLedger(limit = 20) {
  const userId = await getUserId()
  return db.select().from(ledgerEntries).where(eq(ledgerEntries.userId, userId)).orderBy(desc(ledgerEntries.createdAt)).limit(Math.min(Math.max(limit, 1), 50))
}

const depositSchema = z.object({ amountMinor: z.number().int().positive().max(100_000_000_000), senderName: z.string().trim().min(2).max(120), transferReference: z.string().trim().min(4).max(120) })
export async function submitDeposit(input: z.input<typeof depositSchema>) {
  const userId = await getUserId()
  const data = depositSchema.parse(input)
  const [deposit] = await db.insert(deposits).values({ userId, ...data }).returning()
  revalidatePath('/')
  return deposit
}

const withdrawalSchema = z.object({ amountMinor: z.number().int().positive().max(100_000_000_000), payoutAccountId: z.string().uuid() })
export async function submitWithdrawal(input: z.input<typeof withdrawalSchema>) {
  const userId = await getUserId()
  const data = withdrawalSchema.parse(input)
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
  const [account] = await db.select().from(payoutAccounts).where(and(eq(payoutAccounts.id, data.payoutAccountId), eq(payoutAccounts.userId, userId))).limit(1)
  if (!wallet || wallet.availableMinor < data.amountMinor) throw new Error('Insufficient available balance')
  if (!account) throw new Error('Payout account not found')
  const feeMinor = Math.round(data.amountMinor * 0.01)
  const [withdrawal] = await db.insert(withdrawals).values({ userId, amountMinor: data.amountMinor, feeMinor, netMinor: data.amountMinor - feeMinor, payoutAccountSnapshot: account }).returning()
  await db.update(wallets).set({ availableMinor: wallet.availableMinor - data.amountMinor, updatedAt: new Date() }).where(and(eq(wallets.userId, userId), eq(wallets.availableMinor, wallet.availableMinor)))
  revalidatePath('/')
  return withdrawal
}
