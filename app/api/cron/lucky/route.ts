import { NextResponse } from 'next/server'
import { closeDueDraws } from '@/app/actions/lucky'
export async function GET(request: Request) { const secret = process.env.CRON_SECRET; const auth = request.headers.get('authorization'); if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); try { const closed = await closeDueDraws(); return NextResponse.json({ closed }) } catch { return NextResponse.json({ error: 'Unable to process draws' }, { status: 500 }) } }
