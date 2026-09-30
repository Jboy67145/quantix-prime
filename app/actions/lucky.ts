'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function sessionUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

export async function getOpenDraws() {
  const user = await getCurrentUser()
  if (!user) return []
  const userId = user.id
  const supabase = await createClient()
  const service = createServiceClient()
  const now = new Date().toISOString()
  const { data: draws, error } = await supabase.from('quantix_lucky_draws')
    .select('id,title,description,reward_type,reward_minor,alternate_reward,entry_cost_minor,opens_at,closes_at,status,winner_count')
    .or('and(status.eq.OPEN,opens_at.lte.' + now + ',closes_at.gt.' + now + '),status.eq.WON,status.eq.CLAIMED')
    .order('closes_at', { ascending: true }).limit(50)
  if (error) throw new Error('Unable to load Lucky Wish draws')
  const { data: entries } = await supabase.from('quantix_lucky_entries').select('id, draw_id').eq('user_id', userId)
  const entryMap = new Map((entries ?? []).map((entry) => [entry.draw_id, entry.id]))
  const completedIds = (draws ?? []).filter((d:any)=>d.status === 'WON' || d.status === 'CLAIMED').map((d:any)=>d.id)
  const winnersByDraw = new Map<string, any[]>()
  if (completedIds.length) {
    const { data: winners } = await service.from('quantix_lucky_winners').select('draw_id,user_id,created_at,claimed_at').in('draw_id', completedIds).order('created_at', { ascending: true })
    const ids = [...new Set((winners ?? []).map((w:any)=>w.user_id))]
    const { data: profiles } = ids.length ? await service.from('profiles').select('id,name,username').in('id', ids) : { data: [] as any[] }
    const byId = new Map((profiles ?? []).map((p:any)=>[p.id,p]))
    for (const w of winners ?? []) {
      const list = winnersByDraw.get(w.draw_id) ?? []
      const p = byId.get(w.user_id)
      list.push({ username:p?.username || 'User', name:p?.name || 'Winner', selectedAt:w.created_at, claimedAt:w.claimed_at })
      winnersByDraw.set(w.draw_id,list)
    }
  }
  return (draws ?? []).map((draw:any) => ({
    draw: { id:draw.id,title:draw.title,description:draw.description,rewardType:draw.reward_type,rewardMinor:draw.reward_minor,alternateReward:draw.alternate_reward,entryCostMinor:draw.entry_cost_minor,opensAt:draw.opens_at,closesAt:draw.closes_at,status:draw.status,winnerCount:draw.winner_count,winners:winnersByDraw.get(draw.id) ?? [] },
    entryId: entryMap.get(draw.id) ?? null,
  }))
}

export async function joinDraw(drawId: string) {
  await sessionUser()
  const id = z.string().uuid().parse(drawId)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('join_lucky_draw_atomic', { p_draw_id: id })
  if (error || !data) throw new Error(error?.message || 'Unable to join draw')
  revalidatePath('/')
  return data
}

export async function claimReward(drawId: string) {
  await sessionUser()
  const id = z.string().uuid().parse(drawId)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('claim_lucky_reward_atomic', { p_draw_id: id })
  if (error || !data) throw new Error(error?.message || 'Unable to claim Lucky Wish reward')
  revalidatePath('/')
  return data
}

export async function closeDueDraws() {
  const { createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('process_lucky_draws_atomic')
  if (error) throw new Error(error.message)
  return Number(data || 0)
}
