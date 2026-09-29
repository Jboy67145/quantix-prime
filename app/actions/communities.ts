'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdminUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const communitySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(''),
  joinUrl: z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), 'Enter a valid community URL.'),
  iconUrl: z.string().trim().url().optional().or(z.literal('')).default(''),
  active: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(9999).default(0),
})

export async function getCommunities() {
  const s = createClient()
  const { data, error } = await s
    .from('quantix_communities')
    .select('id,name,description,join_url,icon_url,active,display_order,created_at,updated_at')
    .eq('active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

export async function saveCommunity(input: z.input<typeof communitySchema>) {
  const actor = await requireAdminUser()
  const d = communitySchema.parse(input)
  const s = createClient()
  const payload = {
    name: d.name,
    description: d.description || null,
    join_url: d.joinUrl,
    icon_url: d.iconUrl || null,
    active: d.active,
    display_order: d.displayOrder,
    updated_at: new Date().toISOString(),
  }
  const before = d.id
    ? (await s.from('quantix_communities').select('*').eq('id', d.id).maybeSingle()).data
    : null
  const result = d.id
    ? await s.from('quantix_communities').update(payload).eq('id', d.id).select().single()
    : await s.from('quantix_communities').insert(payload).select().single()
  if (result.error) throw new Error(result.error.message)
  const { error: auditError } = await s.from('quantix_audit_logs').insert({
    actor_id: actor.user.id,
    actor_role: actor.profile.role,
    action: d.id ? 'COMMUNITY_UPDATED' : 'COMMUNITY_CREATED',
    target_type: 'COMMUNITY',
    target_id: result.data.id,
    reason: d.id ? 'Community details updated by administrator.' : 'Community added by administrator.',
    before_state: before || null,
    after_state: result.data,
  })
  if (auditError) throw new Error(`Community saved, but audit logging failed: ${auditError.message}`)
  revalidatePath('/')
  revalidatePath('/communities')
  revalidatePath('/admin')
  return result.data
}

export async function deleteCommunity(id: string) {
  const actor = await requireAdminUser()
  const communityId = z.string().uuid().parse(id)
  const s = createClient()
  const before = (await s.from('quantix_communities').select('*').eq('id', communityId).maybeSingle()).data
  if (!before) throw new Error('Community not found.')
  const result = await s.from('quantix_communities').update({
    active: false,
    updated_at: new Date().toISOString(),
  }).eq('id', communityId).select().single()
  if (result.error) throw new Error(result.error.message)
  const { error: auditError } = await s.from('quantix_audit_logs').insert({
    actor_id: actor.user.id,
    actor_role: actor.profile.role,
    action: 'COMMUNITY_DELETED',
    target_type: 'COMMUNITY',
    target_id: communityId,
    reason: 'Community removed from the user-facing community directory.',
    before_state: before,
    after_state: result.data,
  })
  if (auditError) throw new Error(`Community removed, but audit logging failed: ${auditError.message}`)
  revalidatePath('/')
  revalidatePath('/communities')
  revalidatePath('/admin')
  return result.data
}
