import { processMaturities } from '@/app/actions/wallet'
export async function GET(request: Request) { const authorization = request.headers.get('authorization'); if (process.env.CRON_SECRET && authorization !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 }); const processed = await processMaturities(); return Response.json({ processed }) }
