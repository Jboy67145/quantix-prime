'use server'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const pathname = request.nextUrl.searchParams.get('pathname')
  if (!pathname) return NextResponse.json({ error: 'Missing pathname' }, { status: 400 })
  const supabase = await createClient()
  const { data: deposit } = await supabase.from('quantix_deposits').select('user_id').eq('proof_url', pathname).maybeSingle()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!deposit || (deposit.user_id !== user.id && !['ADMIN', 'SUPER_ADMIN'].includes(String(profile?.role || '').toUpperCase()))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!/^[0-9a-f-]{36}\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|pdf)$/i.test(pathname) || pathname.includes('..')) return NextResponse.json({ error: 'Invalid proof path' }, { status: 400 })
  const { data, error } = await supabase.storage.from('deposit-proofs').download(pathname)
  if (error || !data) return new NextResponse('Not found', { status: 404 })
  return new NextResponse(data, { headers: { 'Content-Type': data.type || 'application/octet-stream', 'Cache-Control': 'private, no-store' } })
}
