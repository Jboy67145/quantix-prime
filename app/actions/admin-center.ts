'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdminUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

async function ctx(){ return await requireAdminUser() }
async function log(actor:any,action:string,type:string,id:string|null,before:any,after:any,reason?:string){
 const s=await createClient()
 await s.from('quantix_audit_logs').insert({actor_id:actor.user.id,actor_role:actor.profile.role,action,target_type:type,target_id:id,reason:reason||null,before_state:before||null,after_state:after||null})
}
export async function getAdminCenter(){
 await ctx(); const s=await createClient()
 const q=await Promise.all([
  s.from('profiles').select('*').order('created_at',{ascending:false}).limit(200),
  s.from('quantix_wallets').select('*').limit(200),
  s.from('quantix_plans').select('*').order('display_order'),
  s.from('quantix_deposits').select('*').order('created_at',{ascending:false}).limit(100),
  s.from('quantix_withdrawals').select('*').order('created_at',{ascending:false}).limit(100),
  s.from('quantix_investments').select('*').order('started_at',{ascending:false}).limit(200),
  s.from('quantix_referrals').select('*').order('created_at',{ascending:false}).limit(200),
  s.from('quantix_lucky_draws').select('*').order('created_at',{ascending:false}).limit(100),
  s.from('quantix_notifications').select('*').order('created_at',{ascending:false}).limit(100),
  s.from('quantix_payment_accounts').select('*').order('display_order'),
  s.from('quantix_payout_accounts').select('*').order('created_at',{ascending:false}).limit(200),
  s.from('quantix_ledger_entries').select('*').order('created_at',{ascending:false}).limit(200),
  s.from('quantix_audit_logs').select('*').order('created_at',{ascending:false}).limit(200),
  s.from('quantix_withdrawal_settings').select('*').limit(1)
 ])
 const e=q.find(x=>x.error); if(e?.error) throw new Error(e.error.message)
 return {profiles:q[0].data||[],wallets:q[1].data||[],plans:q[2].data||[],deposits:q[3].data||[],withdrawals:q[4].data||[],investments:q[5].data||[],referrals:q[6].data||[],draws:q[7].data||[],notifications:q[8].data||[],accounts:q[9].data||[],payouts:q[10].data||[],ledger:q[11].data||[],audits:q[12].data||[],settings:q[13].data?.[0]||null}
}

const plan=z.object({id:z.string().uuid().optional(),name:z.string().min(2),description:z.string().min(2),category:z.enum(['DAILY','WEEKLY','MONTHLY']),minimumMinor:z.number().int().positive(),maximumMinor:z.number().int().positive(),returnBps:z.number().int().nonnegative(),durationDays:z.number().int().positive(),terms:z.string().min(2),purchaseBonusMinor:z.number().int().nonnegative(),active:z.boolean(),displayOrder:z.number().int().min(0)})
export async function savePlan(input:z.input<typeof plan>){
 const a=await ctx(),d=plan.parse(input); if(d.maximumMinor<d.minimumMinor) throw new Error('Maximum must be at least minimum.')
 const s=await createClient(),before=d.id?(await s.from('quantix_plans').select('*').eq('id',d.id).maybeSingle()).data:null
 const p={name:d.name,description:d.description,category:d.category,minimum_minor:d.minimumMinor,maximum_minor:d.maximumMinor,return_bps:d.returnBps,duration_days:d.durationDays,terms:d.terms,purchase_bonus_minor:d.purchaseBonusMinor,active:d.active,display_order:d.displayOrder,deleted_at:null,updated_at:new Date().toISOString()}
 const r=d.id?await s.from('quantix_plans').update(p).eq('id',d.id).select().single():await s.from('quantix_plans').insert(p).select().single()
 if(r.error) throw new Error(r.error.message); await log(a,d.id?'PLAN_UPDATED':'PLAN_CREATED','PLAN',r.data.id,before,r.data); revalidatePath('/'); return r.data
}
export async function archivePlan(id:string,restore:boolean,reason:string){
 const a=await ctx(),i=z.string().uuid().parse(id),s=await createClient(),before=(await s.from('quantix_plans').select('*').eq('id',i).single()).data
 const p=restore?{active:true,deleted_at:null,updated_at:new Date().toISOString()}:{active:false,deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}
 const r=await s.from('quantix_plans').update(p).eq('id',i).select().single(); if(r.error)throw new Error(r.error.message)
 await log(a,restore?'PLAN_RESTORED':'PLAN_ARCHIVED','PLAN',i,before,r.data,reason); revalidatePath('/'); return r.data
}
export async function setUserState(id:string,status:'ACTIVE'|'SUSPENDED'|'RESTRICTED',reason:string){
 const a=await ctx(),i=z.string().uuid().parse(id),s=await createClient(),before=(await s.from('profiles').select('*').eq('id',i).single()).data
 const r=await s.from('profiles').update({status,suspended_at:status==='ACTIVE'?null:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',i).select().single()
 if(r.error)throw new Error(r.error.message); await log(a,'USER_STATUS_CHANGED','USER',i,before,r.data,reason); return r.data
}
export async function savePolicy(input:any){
 const a=await ctx(),s=await createClient(),old=(await s.from('quantix_withdrawal_settings').select('*').limit(1).maybeSingle()).data
 const p={timezone:input.timezone,enabled_days:input.enabledDays,start_time:input.startTime,end_time:input.endTime,minimum_minor:Number(input.minimumMinor),maximum_minor:input.maximumMinor==null?null:Number(input.maximumMinor),enabled:Boolean(input.enabled),updated_at:new Date().toISOString()}
 const r=old?await s.from('quantix_withdrawal_settings').update(p).eq('id',old.id).select().single():await s.from('quantix_withdrawal_settings').insert(p).select().single()
 if(r.error)throw new Error(r.error.message); await log(a,'WITHDRAWAL_POLICY_UPDATED','WITHDRAWAL_SETTINGS',r.data.id,old,r.data); return r.data
}
export async function sendAdminNotification(userId:string|null,title:string,body:string,type:string){
 const a=await ctx(),s=await createClient()
 if(userId){const r=await s.from('quantix_notifications').insert({user_id:userId,title,body,type}).select().single();if(r.error)throw new Error(r.error.message);await log(a,'USER_NOTIFICATION_SENT','NOTIFICATION',r.data.id,null,r.data)}
 else{const u=(await s.from('profiles').select('id').eq('status','ACTIVE')).data||[];if(u.length){const r=await s.from('quantix_notifications').insert(u.map(x=>({user_id:x.id,title,body,type})));if(r.error)throw new Error(r.error.message)}await log(a,'BROADCAST_NOTIFICATION_SENT','NOTIFICATION',null,null,{count:u.length,title,body})}
 revalidatePath('/'); return true
}
export async function createDraw(input:any){
 const a=await ctx(),s=await createClient()
 const d=z.object({title:z.string().min(2),description:z.string(),rewardType:z.enum(['CASH','ALTERNATE']),rewardMinor:z.number().int().nonnegative(),alternateReward:z.string(),entryCostMinor:z.number().int().nonnegative(),opensAt:z.string(),closesAt:z.string()}).parse(input)
 const r=await s.from('quantix_lucky_draws').insert({title:d.title,description:d.description,reward_type:d.rewardType,reward_minor:d.rewardMinor,alternate_reward:d.alternateReward||null,entry_cost_minor:d.entryCostMinor,opens_at:new Date(d.opensAt).toISOString(),closes_at:new Date(d.closesAt).toISOString(),status:'OPEN'}).select().single()
 if(r.error)throw new Error(r.error.message);await log(a,'LUCKY_DRAW_CREATED','LUCKY_DRAW',r.data.id,null,r.data);return r.data
}
export async function toggleDraw(id:string,open:boolean){
 const a=await ctx(),s=await createClient(),i=z.string().uuid().parse(id),before=(await s.from('quantix_lucky_draws').select('*').eq('id',i).single()).data
 const r=await s.from('quantix_lucky_draws').update({status:open?'OPEN':'CLOSED',updated_at:new Date().toISOString()}).eq('id',i).select().single();if(r.error)throw new Error(r.error.message)
 await log(a,'LUCKY_DRAW_STATUS_CHANGED','LUCKY_DRAW',i,before,r.data);return r.data
}

export async function updateReferral(id:string,status:'PENDING'|'QUALIFIED',rewardMinor:number,reason:string){
 const a=await ctx(),i=z.string().uuid().parse(id),s=await createClient(),before=(await s.from('quantix_referrals').select('*').eq('id',i).single()).data
 const r=await s.from('quantix_referrals').update({status,reward_minor:Math.max(0,Math.trunc(rewardMinor)),qualified_at:status==='QUALIFIED'?new Date().toISOString():null}).eq('id',i).select().single()
 if(r.error)throw new Error(r.error.message);await log(a,'REFERRAL_UPDATED','REFERRAL',i,before,r.data,reason);return r.data
}
export async function archivePayout(id:string,reason:string){
 const a=await ctx(),i=z.string().uuid().parse(id),s=await createClient(),before=(await s.from('quantix_payout_accounts').select('*').eq('id',i).single()).data
 const r=await s.from('quantix_payout_accounts').update({deleted_at:new Date().toISOString(),is_default:false}).eq('id',i).select().single()
 if(r.error)throw new Error(r.error.message);await log(a,'PAYOUT_ACCOUNT_ARCHIVED','PAYOUT_ACCOUNT',i,before,r.data,reason);return r.data
}
