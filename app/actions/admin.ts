'use server'

import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { deposits, auditLogs, user } from '@/lib/db/schema'

async function getAdmin() {
  const session = await auth.getSession()
  if (!session?.user) throw new Error('Unauthorized')
  const [adminUser] = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.id, session.user.id)).limit(1)
  if (!adminUser || adminUser.role !== 'ADMIN') throw new Error('Forbidden')
  return adminUser.id
}

export async function getPendingDeposits() {
  await getAdmin()
  return db.select().from(deposits).where(eq(deposits.status, 'PENDING')).orderBy(desc(deposits.createdAt))
}

export async function reviewDeposit(input: { id: string; status: 'APPROVED' | 'REJECTED'; reason?: string }) {
  const adminId = await getAdmin()
  const [deposit] = await db.update(deposits).set({ status: input.status, adminNote: input.reason?.trim() || null, reviewedAt: new Date() }).where(and(eq(deposits.id, input.id), eq(deposits.status, 'PENDING'))).returning()
  if (!deposit) throw new Error('Deposit is no longer pending')
  await db.insert(auditLogs).values({ actorId: adminId, actorRole: 'ADMIN', action: `DEPOSIT_${input.status}`, targetType: 'DEPOSIT', targetId: input.id, reason: input.reason?.trim() || null, afterState: deposit })
  revalidatePath('/admin')
  return deposit
}
