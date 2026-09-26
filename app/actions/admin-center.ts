'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdminUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function ctx(){ return await requireAdminUser() }

async function log(actor:any,action:string,type:string,id:string|null,before:any,after:any,reason?:string){
  const s=await createClient()
  const { error } = await s.from('quantix_audit_logs').insert({
    actor_id:actor.user.id,
    actor_role:actor.profile.role,
    action,
    target_type:type,
    target_id:id,
    reason:reason || null,
    before_state:before || null,
    after_state:after || null,
  })
  if (error) throw new Error(`Audit log failed: ${error.message}`)
}

async function listAllAuthUsers(s:any){
  const users:any[]=[]
  for(let page=1;;page++){
    const {data,error}=await s.auth.admin.listUsers({page,perPage:1000})
    if(error) throw new Error(`Unable to read Supabase Auth users: ${error.message}`)
    users.push(...(data.users||[]))
    if((data.users||[]).length<1000) break
  }
  return users
}

export async function getAdminCenter(){
  await ctx()
  // This is a server-only, admin-authorized read. The normal authenticated client is
  // intentionally subject to RLS, which can otherwise make the admin see only its own
  // profile. The service client bypasses RLS after requireAdminUser() has succeeded.
  const s=createServiceClient()
  const [q,authUsers]=await Promise.all([
    Promise.all([
      s.from('profiles').select('*').order('created_at',{ascending:false}).limit(5000),
      s.from('quantix_wallets').select('*').limit(5000),
      s.from('quantix_plans').select('*').order('display_order'),
      s.from('quantix_deposits').select('*').order('created_at',{ascending:false}).limit(5000),
      s.from('quantix_withdrawals').select('*').order('created_at',{ascending:false}).limit(5000),
      s.from('quantix_investments').select('*').order('started_at',{ascending:false}).limit(5000),
      s.from('quantix_referrals').select('*').order('created_at',{ascending:false}).limit(5000),
      s.from('quantix_lucky_draws').select('*').order('created_at',{ascending:false}).limit(2000),
      s.from('quantix_notifications').select('*').order('created_at',{ascending:false}).limit(5000),
      s.from('quantix_marquee_items').select('*').order('created_at',{ascending:false}).limit(200),
      s.from('quantix_payment_accounts').select('*').order('display_order'),
      s.from('quantix_payout_accounts').select('*').order('created_at',{ascending:false}).limit(5000),
      s.from('quantix_ledger_entries').select('*').order('created_at',{ascending:false}).limit(5000),
      s.from('quantix_audit_logs').select('*').order('created_at',{ascending:false}).limit(5000),
      s.from('quantix_withdrawal_settings').select('*').limit(1),
      s.from('quantix_deposit_settings').select('*').limit(1),
    ]),
    listAllAuthUsers(s),
  ])
  const failed=q.find(x=>x.error)
  if(failed?.error) throw new Error(failed.error.message)

  const profileRows=q[0].data||[]
  const profileById=new Map(profileRows.map((p:any)=>[p.id,p]))
  const authById=new Map(authUsers.map((u:any)=>[u.id,u]))
  const profiles=authUsers.map((u:any)=>{
    const p=profileById.get(u.id)
    return p
      ? {...p,email:u.email||null,auth_created_at:u.created_at,auth_last_sign_in_at:u.last_sign_in_at||null,account_source:'AUTH'}
      : {
          id:u.id,
          name:u.user_metadata?.name||u.email?.split('@')[0]||'Unnamed',
          username:u.user_metadata?.username||'',
          role:'USER',
          status:'ACTIVE',
          invite_code:null,
          referred_by_code:null,
          created_at:u.created_at,
          updated_at:u.updated_at||u.created_at,
          email:u.email||null,
          auth_created_at:u.created_at,
          auth_last_sign_in_at:u.last_sign_in_at||null,
          account_source:'AUTH_PROFILE_MISSING',
        }
  })
  // Keep profile-only rows visible too, so data corruption never silently disappears
  // from the control center. These are not counted as registered Auth accounts.
  for(const p of profileRows){
    if(!authById.has(p.id)) profiles.push({...p,email:null,account_source:'PROFILE_ONLY'})
  }

  const walletRows=q[1].data||[]
  const investmentRows=q[5].data||[]
  const referralRows=q[6].data||[]
  // Build user-facing financial totals from the same live wallet/investment records
  // the admin sees, so Manage Users and Wallet never show stale/derived placeholders.

  const walletByUser=new Map(walletRows.map((w:any)=>[w.user_id,w]))
  const investmentByUser=new Map<string, any[]>()
  for(const inv of investmentRows){ const list=investmentByUser.get(inv.user_id)||[]; list.push(inv); investmentByUser.set(inv.user_id,list) }
  const referralByReferrer=new Map<string, any[]>()
  for(const ref of referralRows){ const list=referralByReferrer.get(ref.referrer_user_id)||[]; list.push(ref); referralByReferrer.set(ref.referrer_user_id,list) }
  const enrichedProfiles=profiles.map((p:any)=>{
    const w=walletByUser.get(p.id)
    const invs=investmentByUser.get(p.id)||[]
    const refs=referralByReferrer.get(p.id)||[]
    const qualified=refs.filter((r:any)=>r.status==='QUALIFIED')
    return {
      ...p,
      available_balance_minor:Number(w?.available_minor||0),
      invested_balance_minor:Number(w?.invested_minor||0),
      profit_balance_minor:Number(w?.profit_minor||0),
      total_investments_count:invs.length,
      active_investments_count:invs.filter((i:any)=>i.status==='ACTIVE').length,
      referral_count:refs.length,
      verified_referral_count:qualified.length,
      pending_referral_count:refs.filter((r:any)=>r.status==='PENDING').length,
      referral_earnings_minor:qualified.reduce((sum:number,r:any)=>sum+Number(r.reward_minor||0),0),
    }
  })

  return {
    profiles:enrichedProfiles,
    registeredAccountCount:authUsers.length,
    registeredUserCount:authUsers.filter((u:any)=>profileById.get(u.id)?.role!=='SUPER_ADMIN'&&profileById.get(u.id)?.role!=='ADMIN').length,
    adminAccountCount:authUsers.filter((u:any)=>{
      const p=profileById.get(u.id)
      return p?.role==='SUPER_ADMIN'||p?.role==='ADMIN'
    }).length,
    profileOnlyCount:profileRows.filter((p:any)=>!authById.has(p.id)).length,
    wallets:q[0].data||[], plans:q[2].data||[],
    deposits:q[3].data||[], withdrawals:q[4].data||[], investments:q[5].data||[],
    referrals:q[6].data||[], draws:q[7].data||[], notifications:q[8].data||[], marqueeItems:q[9].data||[],
    accounts:q[10].data||[], payouts:q[11].data||[], ledger:q[12].data||[],
    audits:q[13].data||[], settings:q[14].data?.[0]||null, depositSettings:q[15].data?.[0]||null,
  }
}

const uuid=z.string().uuid()
const plan=z.object({
  id:uuid.optional(),
  name:z.string().trim().min(2).max(120),
  description:z.string().trim().min(2).max(1000),
  category:z.enum(['DAILY','WEEKLY','MONTHLY']),
  minimumMinor:z.number().int().positive(),
  maximumMinor:z.number().int().positive(),
  returnMinor:z.number().int().nonnegative(),
  durationDays:z.number().int().positive().max(3650),
  terms:z.string().trim().min(2).max(5000),
  purchaseBonusMinor:z.number().int().nonnegative(),
  active:z.boolean(),
  displayOrder:z.number().int().min(0).max(9999),
})

export async function savePlan(input:z.input<typeof plan>){
  const a=await ctx()
  const d=plan.parse(input)
  if(d.maximumMinor<d.minimumMinor) throw new Error('Maximum amount must be at least the minimum amount.')
  const s=await createClient()
  const before=d.id?(await s.from('quantix_plans').select('*').eq('id',d.id).maybeSingle()).data:null
  const payload={
    name:d.name,description:d.description,category:d.category,
    minimum_minor:d.minimumMinor,maximum_minor:d.maximumMinor,return_minor:d.returnMinor,
    return_bps:d.minimumMinor>0?Math.round(d.returnMinor*10000/d.minimumMinor):0,
    duration_days:d.durationDays,terms:d.terms,purchase_bonus_minor:d.purchaseBonusMinor,
    active:d.active,display_order:d.displayOrder,deleted_at:null,updated_at:new Date().toISOString(),
  }
  const r=d.id
    ? await s.from('quantix_plans').update(payload).eq('id',d.id).select().single()
    : await s.from('quantix_plans').insert(payload).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,d.id?'PLAN_UPDATED':'PLAN_CREATED','PLAN',r.data.id,before,r.data)

  // Marquee highlights are separate from the notification inbox. Editing a plan
  // creates only a marquee highlight; creating a new plan creates both a marquee
  // highlight and a notification inbox entry.
  const audience = {
    title: d.id ? 'Investment plan updated' : 'New investment plan available',
    content: d.id
      ? `${r.data.name} has been updated. Review the latest investment amount, return earned, duration and purchase bonus in the Invest section.`
      : `${r.data.name} is now available. Investment: ₦${(r.data.minimum_minor/100).toLocaleString('en-NG')}; return earned: ₦${(r.data.return_minor/100).toLocaleString('en-NG')}; duration: ${r.data.duration_days} days; purchase bonus: ₦${(r.data.purchase_bonus_minor/100).toLocaleString('en-NG')}.`,
    kind: d.id ? 'PLAN_UPDATE' : 'NEW_PLAN',
  }
  const marquee=await s.from('quantix_marquee_items').insert({
    user_id:null,title:audience.title,content:audience.content,kind:audience.kind,active:true,
  }).select().single()
  if(marquee.error) throw new Error(`Plan saved, but marquee publication failed: ${marquee.error.message}`)

  if(!d.id){
    const recipients=(await s.from('profiles').select('id')).data||[]
    if(recipients.length){
      const n=await s.from('quantix_notifications').insert(recipients.map((u:any)=>({
        user_id:u.id,title:`New investment plan: ${r.data.name}`,
        body:audience.content,type:'NEW_PLAN'
      })))
      if(n.error) throw new Error(`Plan saved, but notification publication failed: ${n.error.message}`)
    }
  }
  revalidatePath('/')
  revalidatePath('/admin')
  return r.data
}

export async function archivePlan(id:string,restore:boolean,reason:string){
  const a=await ctx(),i=uuid.parse(id),s=await createClient()
  const before=(await s.from('quantix_plans').select('*').eq('id',i).maybeSingle()).data
  if(!before) throw new Error('Investment plan not found.')
  const payload=restore
    ? {active:true,deleted_at:null,updated_at:new Date().toISOString()}
    : {active:false,deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}
  const r=await s.from('quantix_plans').update(payload).eq('id',i).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,restore?'PLAN_RESTORED':'PLAN_ARCHIVED','PLAN',i,before,r.data,reason)
  revalidatePath('/')
  revalidatePath('/admin')
  return r.data
}

const userProfile=z.object({
  id:uuid,
  name:z.string().trim().min(2).max(120),
  username:z.string().trim().min(2).max(80).regex(/^[a-zA-Z0-9_.-]+$/),
})
export async function updateUserProfile(input:z.input<typeof userProfile>){
  const a=await ctx(),d=userProfile.parse(input),s=await createClient()
  const before=(await s.from('profiles').select('*').eq('id',d.id).maybeSingle()).data
  if(!before) throw new Error('User profile not found.')
  const r=await s.from('profiles').update({name:d.name,username:d.username,updated_at:new Date().toISOString()}).eq('id',d.id).select().single()
  if(r.error){
    if(r.error.code==='23505') throw new Error('That username is already in use.')
    throw new Error(r.error.message)
  }
  await log(a,'USER_PROFILE_UPDATED','USER',d.id,before,r.data,'Administrative profile edit')
  revalidatePath('/admin')
  revalidatePath('/')
  return r.data
}

export async function setUserState(id:string,status:'ACTIVE'|'SUSPENDED'|'RESTRICTED',reason:string){
  const a=await ctx(),i=uuid.parse(id),s=await createClient()
  if(i===a.user.id && status!=='ACTIVE') throw new Error('You cannot suspend or restrict the currently signed-in administrator.')
  const before=(await s.from('profiles').select('*').eq('id',i).maybeSingle()).data
  if(!before) throw new Error('User profile not found.')
  const r=await s.from('profiles').update({
    status,
    suspended_at:status==='ACTIVE'?null:new Date().toISOString(),
    updated_at:new Date().toISOString(),
  }).eq('id',i).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,'USER_STATUS_CHANGED','USER',i,before,r.data,reason)
  revalidatePath('/admin')
  revalidatePath('/')
  return r.data
}

const policy=z.object({
  timezone:z.string().trim().min(1).max(80),
  enabledDays:z.array(z.enum(['MON','TUE','WED','THU','FRI','SAT','SUN'])).min(1),
  startTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  minimumMinor:z.number().int().min(100000),
  maximumMinor:z.number().int().positive().nullable(),
  enabled:z.boolean(),
})
export async function savePolicy(input:z.input<typeof policy>){
  const a=await ctx(),d=policy.parse(input),s=await createClient()
  try{ new Intl.DateTimeFormat('en-US',{timeZone:d.timezone}).format() }catch{ throw new Error('Enter a valid IANA timezone, for example Africa/Lagos.') }
  if(d.minimumMinor<100000) throw new Error('Minimum withdrawal cannot be lower than ₦1,000.')
  if(d.maximumMinor!==null && d.maximumMinor<d.minimumMinor) throw new Error('Maximum withdrawal must be at least the minimum.')
  const old=(await s.from('quantix_withdrawal_settings').select('*').limit(1).maybeSingle()).data
  const payload={
    timezone:d.timezone,enabled_days:d.enabledDays,start_time:d.startTime,end_time:d.endTime,
    minimum_minor:d.minimumMinor,maximum_minor:d.maximumMinor,enabled:d.enabled,updated_at:new Date().toISOString(),
  }
  const r=old
    ? await s.from('quantix_withdrawal_settings').update(payload).eq('id',old.id).select().single()
    : await s.from('quantix_withdrawal_settings').insert(payload).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,'WITHDRAWAL_POLICY_UPDATED','WITHDRAWAL_SETTINGS',r.data.id,old,r.data)
  revalidatePath('/admin')
  revalidatePath('/')
  return r.data
}

const depositPolicy=z.object({
  timezone:z.string().trim().min(1).max(80),
  enabledDays:z.array(z.enum(['MON','TUE','WED','THU','FRI','SAT','SUN'])).min(1),
  startTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  enabled:z.boolean(),
})

export async function saveDepositPolicy(input:z.input<typeof depositPolicy>){
  const a=await ctx(),d=depositPolicy.parse(input),s=await createClient()
  try{ new Intl.DateTimeFormat('en-US',{timeZone:d.timezone}).format() }catch{ throw new Error('Enter a valid IANA timezone, for example Africa/Lagos.') }
  const old=(await s.from('quantix_deposit_settings').select('*').limit(1).maybeSingle()).data
  const payload={singleton:true,timezone:d.timezone,enabled_days:d.enabledDays,start_time:d.startTime,end_time:d.endTime,enabled:d.enabled,updated_at:new Date().toISOString()}
  const r=old
    ? await s.from('quantix_deposit_settings').update(payload).eq('id',old.id).select().single()
    : await s.from('quantix_deposit_settings').insert(payload).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,'DEPOSIT_POLICY_UPDATED','DEPOSIT_SETTINGS',r.data.id,old,r.data)
  revalidatePath('/admin')
  revalidatePath('/')
  return r.data
}

const marquee=z.object({
  id:uuid.optional(),userId:uuid.nullable(),title:z.string().trim().min(2).max(160),
  content:z.string().trim().min(2).max(2000),kind:z.string().trim().min(2).max(40),active:z.boolean(),
})
export async function saveMarquee(input:z.input<typeof marquee>){
  const a=await ctx(),d=marquee.parse(input),s=await createClient()
  const before=d.id?(await s.from('quantix_marquee_items').select('*').eq('id',d.id).maybeSingle()).data:null
  const payload={user_id:d.userId,title:d.title,content:d.content,kind:d.kind,active:d.active,updated_at:new Date().toISOString()}
  const r=d.id
    ? await s.from('quantix_marquee_items').update(payload).eq('id',d.id).select().single()
    : await s.from('quantix_marquee_items').insert(payload).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,d.id?'MARQUEE_UPDATED':'MARQUEE_CREATED','MARQUEE',r.data.id,before,r.data)
  revalidatePath('/')
  revalidatePath('/admin')
  return r.data
}
export async function deleteMarquee(id:string){
  const a=await ctx(),i=uuid.parse(id),s=await createClient()
  const before=(await s.from('quantix_marquee_items').select('*').eq('id',i).maybeSingle()).data
  if(!before) throw new Error('Marquee item not found.')
  const r=await s.from('quantix_marquee_items').delete().eq('id',i).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,'MARQUEE_DELETED','MARQUEE',i,before,null,'Administrative deletion')
  revalidatePath('/')
  revalidatePath('/admin')
  return r.data
}
export async function archiveMarquee(id:string){
  const a=await ctx(),i=uuid.parse(id),s=await createClient()
  const before=(await s.from('quantix_marquee_items').select('*').eq('id',i).maybeSingle()).data
  if(!before) throw new Error('Marquee item not found.')
  const r=await s.from('quantix_marquee_items').update({active:false,updated_at:new Date().toISOString()}).eq('id',i).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,'MARQUEE_ARCHIVED','MARQUEE',i,before,r.data)
  revalidatePath('/')
  revalidatePath('/admin')
  return r.data
}

const notification=z.object({
  userId:uuid.nullable(),
  title:z.string().trim().min(2).max(160),
  body:z.string().trim().min(2).max(4000),
  type:z.string().trim().min(2).max(40),
})
export async function sendAdminNotification(userId:string|null,title:string,body:string,type:string){
  const a=await ctx(),d=notification.parse({userId,title,body,type}),s=await createClient()
  if(d.userId){
    const r=await s.from('quantix_notifications').insert({user_id:d.userId,title:d.title,body:d.body,type:d.type}).select().single()
    if(r.error) throw new Error(r.error.message)
    await log(a,'USER_NOTIFICATION_SENT','NOTIFICATION',r.data.id,null,r.data)
  }else{
    const u=(await s.from('profiles').select('id').eq('status','ACTIVE')).data||[]
    if(u.length){
      const r=await s.from('quantix_notifications').insert(u.map(x=>({user_id:x.id,title:d.title,body:d.body,type:d.type})))
      if(r.error) throw new Error(r.error.message)
    }
    await log(a,'BROADCAST_NOTIFICATION_SENT','NOTIFICATION',null,null,{count:u.length,title:d.title,body:d.body,type:d.type})
  }
  revalidatePath('/')
  revalidatePath('/admin')
  return true
}

const draw=z.object({
  id:uuid.optional(),
  title:z.string().trim().min(2).max(160),
  description:z.string().trim().max(2000),
  rewardType:z.enum(['CASH','ALTERNATE']),
  rewardMinor:z.number().int().nonnegative(),
  alternateReward:z.string().trim().max(500),
  entryCostMinor:z.number().int().nonnegative(),
  opensAt:z.string().min(1),
  closesAt:z.string().min(1),
})
export async function createDraw(input:z.input<typeof draw>){
  const a=await ctx(),d=draw.omit({id:true}).parse(input),s=await createClient()
  const opens=new Date(d.opensAt),closes=new Date(d.closesAt)
  if(Number.isNaN(opens.getTime())||Number.isNaN(closes.getTime())||closes<=opens) throw new Error('Choose valid opening and closing times; closing must be after opening.')
  if(d.rewardType==='CASH' && d.rewardMinor<=0) throw new Error('Cash draws need a reward greater than ₦0.')
  const r=await s.from('quantix_lucky_draws').insert({
    title:d.title,description:d.description,reward_type:d.rewardType,reward_minor:d.rewardMinor,
    alternate_reward:d.alternateReward||null,entry_cost_minor:d.entryCostMinor,
    opens_at:opens.toISOString(),closes_at:closes.toISOString(),status:'OPEN',
  }).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,'LUCKY_DRAW_CREATED','LUCKY_DRAW',r.data.id,null,r.data)
  revalidatePath('/')
  revalidatePath('/admin')
  return r.data
}
export async function updateDraw(input:z.input<typeof draw>){
  const a=await ctx(),d=draw.parse(input),s=await createClient()
  if(!d.id) throw new Error('Draw ID is required for editing.')
  const opens=new Date(d.opensAt),closes=new Date(d.closesAt)
  if(Number.isNaN(opens.getTime())||Number.isNaN(closes.getTime())||closes<=opens) throw new Error('Choose valid opening and closing times; closing must be after opening.')
  const before=(await s.from('quantix_lucky_draws').select('*').eq('id',d.id).maybeSingle()).data
  if(!before) throw new Error('Lucky Wish draw not found.')
  const r=await s.from('quantix_lucky_draws').update({
    title:d.title,description:d.description,reward_type:d.rewardType,reward_minor:d.rewardMinor,
    alternate_reward:d.alternateReward||null,entry_cost_minor:d.entryCostMinor,
    opens_at:opens.toISOString(),closes_at:closes.toISOString(),updated_at:new Date().toISOString(),
  }).eq('id',d.id).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,'LUCKY_DRAW_UPDATED','LUCKY_DRAW',d.id,before,r.data)
  revalidatePath('/')
  revalidatePath('/admin')
  return r.data
}
export async function toggleDraw(id:string,open:boolean){
  const a=await ctx(),s=await createClient(),i=uuid.parse(id)
  const before=(await s.from('quantix_lucky_draws').select('*').eq('id',i).maybeSingle()).data
  if(!before) throw new Error('Lucky Wish draw not found.')
  const r=await s.from('quantix_lucky_draws').update({status:open?'OPEN':'CLOSED',updated_at:new Date().toISOString()}).eq('id',i).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,'LUCKY_DRAW_STATUS_CHANGED','LUCKY_DRAW',i,before,r.data)
  revalidatePath('/')
  revalidatePath('/admin')
  return r.data
}

export async function updateReferral(id:string,status:'PENDING'|'QUALIFIED',rewardMinor:number,reason:string){
  const a=await ctx(),i=uuid.parse(id),s=await createClient()
  if(!Number.isInteger(rewardMinor)||rewardMinor<0) throw new Error('Referral reward must be a non-negative whole minor-unit amount.')

  const before=(await s.from('quantix_referrals').select('*').eq('id',i).maybeSingle()).data
  if(!before) throw new Error('Referral record not found.')

  if(status==='QUALIFIED'){
    const { data, error } = await s.rpc('qualify_referral_atomic',{
      p_referral_id:i,
      p_reward_minor:Math.max(0,Math.trunc(rewardMinor)),
      p_reason:reason,
    })
    if(error || !data) throw new Error(error?.message || 'Unable to qualify and pay this referral.')
    revalidatePath('/')
    revalidatePath('/admin')
    return data
  }

  if(before.status==='QUALIFIED'){
    throw new Error('A qualified referral has already been paid and cannot be reset.')
  }

  const r=await s.from('quantix_referrals').update({
    status:'PENDING',
    reward_minor:Math.max(0,Math.trunc(rewardMinor)),
    qualified_at:null,
  }).eq('id',i).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,'REFERRAL_RESET','REFERRAL',i,before,r.data,reason)
  revalidatePath('/')
  revalidatePath('/admin')
  return r.data
}

export async function archivePayout(id:string,reason:string){
  const a=await ctx(),i=uuid.parse(id),s=await createClient()
  const before=(await s.from('quantix_payout_accounts').select('*').eq('id',i).maybeSingle()).data
  if(!before) throw new Error('Payout account not found.')
  const r=await s.from('quantix_payout_accounts').update({deleted_at:new Date().toISOString(),is_default:false}).eq('id',i).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,'PAYOUT_ACCOUNT_ARCHIVED','PAYOUT_ACCOUNT',i,before,r.data,reason)
  revalidatePath('/admin')
  return r.data
}

export async function restorePayout(id:string,reason:string){
  const a=await ctx(),i=uuid.parse(id),s=await createClient()
  const before=(await s.from('quantix_payout_accounts').select('*').eq('id',i).maybeSingle()).data
  if(!before) throw new Error('Payout account not found.')
  const r=await s.from('quantix_payout_accounts').update({deleted_at:null}).eq('id',i).select().single()
  if(r.error) throw new Error(r.error.message)
  await log(a,'PAYOUT_ACCOUNT_RESTORED','PAYOUT_ACCOUNT',i,before,r.data,reason)
  revalidatePath('/admin')
  return r.data
}

export async function processInvestmentMaturity(id:string){
  const a=await ctx(),i=uuid.parse(id),s=await createClient()
  const before=(await s.from('quantix_investments').select('*').eq('id',i).maybeSingle()).data
  if(!before) throw new Error('Investment not found.')
  if(before.status!=='ACTIVE') throw new Error('This investment is no longer active.')
  if(new Date(before.matures_at).getTime()>Date.now()) throw new Error('This investment has not reached maturity yet.')
  const { data: result, error } = await s.rpc('process_maturity_atomic',{p_investment_id:i})
  if(error||!result) throw new Error(error?.message||'Maturity could not be processed.')
  await log(a,'INVESTMENT_MATURED_MANUALLY','INVESTMENT',i,before,result,'Administrator triggered due maturity processing')
  revalidatePath('/admin')
  revalidatePath('/')
  return result
}
