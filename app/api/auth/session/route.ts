import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  return NextResponse.json(
    { user: user ? { id: user.id, email: user.email ?? null } : null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
