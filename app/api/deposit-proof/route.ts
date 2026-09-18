'use server'

import { get } from '@vercel/blob'
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
  const { data: profile } = await supabase.from('user').select('role').eq('id', user.id).maybeSingle()
  if (!deposit || (deposit.user_id !== user.id && profile?.role !== 'ADMIN')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await get(pathname, { access: 'private', ifNoneMatch: request.headers.get('if-none-match') ?? undefined })
  if (!result) return new NextResponse('Not found', { status: 404 })
  if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' } })
  return new NextResponse(result.stream, { headers: { 'Content-Type': result.blob.contentType, ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' } })
}
