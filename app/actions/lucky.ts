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
  const userId = await sessionUser()
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data: draws, error } = await supabase.from('quantix_lucky_draws').select('*').eq('status', 'OPEN').lte('opens_at', now).gte('closes_at', now).order('closes_at', { ascending: false })
  if (error) throw new Error('Unable to load Lucky Wish draws')
  const { data: entries } = await supabase.from('quantix_lucky_entries').select('id, draw_id').eq('user_id', userId)
  const entryMap = new Map((entries ?? []).map((entry) => [entry.draw_id, entry.id]))
  return (draws ?? []).map((draw) => ({ draw, entryId: entryMap.get(draw.id) ?? null }))
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
  const userId = await sessionUser()
  const id = z.string().uuid().parse(drawId)
  const supabase = await createClient()
  const { data: draw } = await supabase.from('quantix_lucky_draws').select('*').eq('id', id).eq('winner_user_id', userId).maybeSingle()
  if (!draw || draw.claimed_at) throw new Error('Reward is unavailable')
  if (draw.reward_type === 'CASH' && draw.reward_minor) {
    await supabase.from('quantix_ledger_entries').upsert({ user_id: userId, reference: `LUCKY-${draw.id}`, type: 'LUCKY_WIN', amount_minor: draw.reward_minor, direction: 'CREDIT', metadata: { drawId: draw.id } }, { onConflict: 'reference', ignoreDuplicates: true })
  }
  await supabase.from('quantix_lucky_draws').update({ claimed_at: new Date().toISOString(), status: 'CLAIMED', updated_at: new Date().toISOString() }).eq('id', id)
  await supabase.from('quantix_notifications').insert({ user_id: userId, type: 'LUCKY_CLAIMED', title: 'Reward claimed', body: draw.reward_type === 'CASH' ? 'Your cash reward was added to your wallet.' : 'Your reward is now with the operations team.' })
  revalidatePath('/')
  return true
}

export async function closeDueDraws() {
  const supabase = await createClient()
  const { data: due } = await supabase.from('quantix_lucky_draws').select('*').eq('status', 'OPEN').lte('closes_at', new Date().toISOString())
  for (const draw of due ?? []) {
    const { data: entries } = await supabase.from('quantix_lucky_entries').select('*').eq('draw_id', draw.id)
    if (!entries?.length) {
      await supabase.from('quantix_lucky_draws').update({ status: 'CLOSED', updated_at: new Date().toISOString() }).eq('id', draw.id)
      continue
    }
    const winner = entries[Math.floor(Math.random() * entries.length)]
    await supabase.from('quantix_lucky_draws').update({ status: 'WON', winner_user_id: winner.user_id, winner_entry_id: winner.id, updated_at: new Date().toISOString() }).eq('id', draw.id).eq('status', 'OPEN')
    await supabase.from('quantix_notifications').insert({ user_id: winner.user_id, type: 'LUCKY_WIN', title: 'You won Lucky Wish', body: draw.reward_type === 'CASH' ? 'Your cash reward is ready to claim.' : `Your ${draw.alternate_reward || 'reward'} is ready to claim.` })
  }
  return due?.length ?? 0
}
