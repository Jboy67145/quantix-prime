'use server'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
async function uid() { const s = await auth.getSession(); if (!s?.user) throw new Error('Unauthorized'); return s.user.id }
export async function getNotifications() { const userId = await uid(); return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(30) }
export async function markNotificationRead(id: string) { const userId = await uid(); await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, userId))); revalidatePath('/') }
