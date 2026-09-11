import { NextResponse } from 'next/server'
import { closeDueDraws } from '@/app/actions/lucky'
export async function GET(request: Request) { const auth = request.headers.get('authorization'); if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); try { const closed = await closeDueDraws(); return NextResponse.json({ closed }) } catch { return NextResponse.json({ error: 'Unable to process draws' }, { status: 500 }) } }
