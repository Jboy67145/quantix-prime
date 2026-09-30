'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

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
  const winnersByDraw = new Map<string, any[]>()
  if (completedIds.length) {
    const { data: winners, error: winnersError } = await supabase.rpc('get_lucky_winners_public', { p_draw_ids: completedIds })
    if (winnersError) throw new Error('Unable to load Lucky Wish winners')
    for (const w of winners ?? []) {
      const list = winnersByDraw.get(w.draw_id) ?? []
      list.push({ username:w.username || 'User', name:w.name || 'Winner', selectedAt:w.selected_at, claimedAt:w.claimed_at })
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
