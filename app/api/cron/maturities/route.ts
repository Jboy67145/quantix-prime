import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const authorization = request.headers.get('authorization')
  if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createServiceClient()
    const { data: due, error } = await supabase
      .from('quantix_investments')
      .select('id')
      .eq('status', 'ACTIVE')
      .lte('matures_at', new Date().toISOString())
    if (error) throw error

    let processed = 0
    for (const investment of due ?? []) {
      const { data, error: processError } = await supabase.rpc('process_maturity_atomic', { p_investment_id: investment.id })
      if (processError) throw processError
      if (data) processed += 1
    }
    return NextResponse.json({ processed })
  } catch (error) {
    console.error('Maturity cron failed', error)
    return NextResponse.json({ error: 'Unable to process maturities' }, { status: 500 })
  }
}
