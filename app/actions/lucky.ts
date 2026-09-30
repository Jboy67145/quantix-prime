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
  const now = new Date().toISOString()
  const { data: draws, error } = await supabase
    .from('quantix_lucky_draws')
    .select('id,title,description,reward_type,reward_minor,alternate_reward,entry_cost_minor,opens_at,closes_at,status,winner_count')
    .eq('status', 'OPEN')
    .lte('opens_at', now)
    .gt('closes_at', now)
    .order('closes_at', { ascending: true })
  if (error) throw new Error('Unable to load Lucky Wish draws')
  const { data: entries } = await supabase.from('quantix_lucky_entries').select('id, draw_id').eq('user_id', userId)
  const entryMap = new Map((entries ?? []).map((entry) => [entry.draw_id, entry.id]))
  return (draws ?? []).map((draw) => ({
    draw: {
      id: draw.id,
      title: draw.title,
      description: draw.description,
      rewardType: draw.reward_type,
      rewardMinor: draw.reward_minor,
      alternateReward: draw.alternate_reward,
      entryCostMinor: draw.entry_cost_minor,
      opensAt: draw.opens_at,
      closesAt: draw.closes_at,
      status: draw.status,
      winnerCount: draw.winner_count,
    },
    entryId: entryMap.get(draw.id) ?? null,
  }))
}

export async function joinDraw(drawId: string) {
  const userId = await sessionUser()
  const id = z.string().uuid().parse(drawId)
  const supabase = await createClient()
  const { data: draw } = await supabase.from('quantix_lucky_draws').select('*').eq('id', id).eq('status', 'OPEN').maybeSingle()
  if (!draw || new Date(draw.closes_at) < new Date()) throw new Error('This draw is closed')
  const { data: entry, error } = await supabase.from('quantix_lucky_entries').insert({ draw_id: id, user_id: userId }).select().single()
  if (error) throw new Error(error.code === '23505' ? 'You have already joined this draw' : 'Unable to join this draw')
  revalidatePath('/')
  return entry
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
