'use client'

import { useEffect,useMemo,useState } from 'react'
import { ArrowLeft, RefreshCw, Shield, Users, Wallet, TrendingUp, Landmark, Gift, Bell, ScrollText, Settings, Archive, RotateCcw, Save, Send, Search, CheckCircle2, Clock3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  getAdminCenter,savePlan,archivePlan,setUserState,savePolicy,sendAdminNotification,
  createDraw,updateDraw,toggleDraw,updateReferral,archivePayout,restorePayout,
  updateUserProfile,processInvestmentMaturity
} from '@/app/actions/admin-center'
import { adjustUserBalance,reviewDeposit } from '@/app/actions/admin'
import { reviewWithdrawal } from '@/app/actions/control'
import { setPaymentAccountActive } from '@/app/actions/payment-accounts'

const naira=(m:number)=>'₦'+(Number(m||0)/100).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})
const date=(v:any)=>v ? new Date(v).toISOString().replace('T',' ').slice(0,16)+' UTC' : '—'
const days=['MON','TUE','WED','THU','FRI','SAT','SUN']

const emptyPlan={name:'',description:'',category:'MONTHLY',minimumMinor:1000000,maximumMinor:1000000,returnBps:500,durationDays:30,terms:'',purchaseBonusMinor:0,active:true,displayOrder:1}
const emptyDraw={title:'',description:'',rewardType:'CASH',rewardMinor:0,alternateReward:'',entryCostMinor:0,opensAt:'',closesAt:''}
const emptyPolicy={timezone:'Africa/Lagos',enabledDays:['MON','TUE','WED','THU','FRI'],startTime:'09:00',endTime:'17:00',minimumMinor:100000,maximumMinor:null,enabled:true}

export default function ControlCenter(){
 const router=useRouter()
 const [data,setData]=useState<any>(null)
 const [tab,setTab]=useState('overview')
 const [busy,setBusy]=useState('')
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const [q,setQ]=useState('')
 const [selectedUser,setSelectedUser]=useState<any>(null)
 const [amount,setAmount]=useState('')
 const [reason,setReason]=useState('')
 const [profile,setProfile]=useState({name:'',username:''})
 const [plan,setPlan]=useState<any>(emptyPlan)
 const [policy,setPolicy]=useState<any>(emptyPolicy)
 const [msg,setMsg]=useState<any>({userId:'',title:'',body:'',type:'SYSTEM'})
 const [draw,setDraw]=useState<any>(emptyDraw)

 const load=async()=>{
   try{
     setError(''); const d=await getAdminCenter(); setData(d)
     if(d.settings)setPolicy({
       timezone:d.settings.timezone,enabledDays:d.settings.enabled_days||[],
       startTime:d.settings.start_time,endTime:d.settings.end_time,
       minimumMinor:Number(d.settings.minimum_minor||0),
       maximumMinor:d.settings.maximum_minor==null?null:Number(d.settings.maximum_minor),
       enabled:Boolean(d.settings.enabled)
     })
   }catch(e){setError(e instanceof Error?e.message:'Unable to load control center.')}
 }
 useEffect(()=>{void load()},[])

 const act=async(k:string,fn:()=>Promise<any>,message?:string)=>{
   try{setBusy(k);setError('');setSuccess('');await fn();await load();if(message)setSuccess(message)}
   catch(e){setError(e instanceof Error?e.message:'Action failed. Nothing was changed.')}
   finally{setBusy('')}
 }

 const users=useMemo(()=>data?.profiles?.filter((u:any)=>(String(u.name)+' '+String(u.username)+' '+u.id).toLowerCase().includes(q.toLowerCase()))||[],[data,q])
 const walletForUser=selectedUser?data?.wallets?.find((w:any)=>w.user_id===selectedUser.id):null

 function selectUser(u:any){
   if(!u){setSelectedUser(null);setProfile({name:'',username:''});return}
   setSelectedUser(u); setProfile({name:u.name||'',username:u.username||''}); setTab('wallet'); setError(''); setSuccess('')
 }

 if(!data)return <main className="admin-shell"><div className="admin-frame"><div className="admin-loading">Loading secure control center…</div></div></main>

 const tabs:any[]=[
  ['overview','Overview',Shield],['users','Users',Users],['wallet','Wallet',Wallet],
  ['deposits','Deposits',Landmark],['withdrawals','Withdrawals',Wallet],
  ['investments','Investments',TrendingUp],['plans','Plans',TrendingUp],
  ['referrals','Referrals',Users],['lucky','Lucky Wish',Gift],['notifications','Notifications',Bell],
  ['accounts','Bank Accounts',Landmark],['payouts','Payout Accounts',Landmark],
  ['ledger','Ledger',ScrollText],['audit','Audit Logs',ScrollText],['settings','Settings',Settings]
 ]

 return <main className="admin-shell">
  <div className="admin-frame max-w-7xl">
   <header className="sticky top-0 z-20 border-b border-white/10 bg-black/85 px-4 py-4 backdrop-blur-xl">
    <div className="flex items-center justify-between gap-3">
     <div className="flex items-center gap-3">
      <button type="button" aria-label="Go back" className="icon-button" onClick={()=>router.back()}><ArrowLeft size={17}/></button>
      <a href="/" className="secondary-button whitespace-nowrap">User Home</a>
      <div className="brand-mark">Q</div><div><strong>quantix</strong><span className="block text-xs tracking-[.25em] opacity-60">PRIME CONTROL CENTER</span></div>
     </div>
     <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act('refresh',load)}><RefreshCw size={16}/> Refresh</button>
    </div>
    <nav aria-label="Admin sections" className="mt-4 flex gap-2 overflow-x-auto pb-1">
     {tabs.map(([id,label,I])=><button type="button" key={id} onClick={()=>{setTab(id);setError('');setSuccess('')}} className={tab===id?'primary-button whitespace-nowrap':'secondary-button whitespace-nowrap'}><I size={15}/>{label}</button>)}
    </nav>
   </header>

   {error&&<div className="admin-error m-4" role="alert"><Shield size={17}/><span>{error}</span></div>}
   {success&&<div className="admin-success m-4" role="status"><CheckCircle2 size={17}/><span>{success}</span></div>}

   <section className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
    {[
      ['Users',data.profiles.length],
      ['Live plans',data.plans.filter((x:any)=>x.active&&!x.deleted_at).length],
      ['Pending deposits',data.deposits.filter((x:any)=>x.status==='PENDING').length],
      ['Pending withdrawals',data.withdrawals.filter((x:any)=>x.status==='PENDING').length]
    ].map((x:any)=><div className="rounded-3xl border border-white/10 bg-white/5 p-5" key={x[0]}><div className="text-sm opacity-60">{x[0]}</div><div className="mt-2 text-3xl font-semibold">{x[1]}</div></div>)}
   </section>

   <div className="p-4">
    {tab==='overview'&&<div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Pending deposits">
       {data.deposits.filter((x:any)=>x.status==='PENDING').map((x:any)=><Row key={x.id} title={naira(x.amount_minor)} meta={x.user_id+' · '+date(x.created_at)}>
        <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>reviewDeposit({id:x.id,status:'APPROVED'}),'Deposit approved.')}>Approve</button>
        <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>reviewDeposit({id:x.id,status:'REJECTED',reason}),'Deposit rejected.')}>Reject</button>
       </Row>)}
       {!data.deposits.some((x:any)=>x.status==='PENDING')&&<Empty text="No pending deposits."/>}
      </Panel>
      <Panel title="Recent audit activity">{data.audits.slice(0,20).map((x:any)=><Row key={x.id} title={x.action} meta={x.target_type+' · '+date(x.created_at)}/>)}</Panel>
    </div>}

    {tab==='users'&&<Panel title="User accounts">
      <div className="mb-4 flex gap-2"><Search className="mt-3 opacity-50"/><input className="account-form flex-1" placeholder="Search name, username or UUID" value={q} onChange={e=>setQ(e.target.value)}/></div>
      {users.map((u:any)=><Row key={u.id} title={(u.name||'Unnamed')+' · '+(u.username||'No username')} meta={u.status+' · '+u.role+' · '+u.id}>
       <button type="button" className="primary-button" onClick={()=>selectUser(u)}>Manage</button>
       {u.status==='ACTIVE'
        ?<button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(u.id,()=>setUserState(u.id,'SUSPENDED','Administrative suspension'),'User suspended.')}>Suspend</button>
        :<button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(u.id,()=>setUserState(u.id,'ACTIVE','Administrative restoration'),'User activated.')}>Activate</button>}
      </Row>)}
    </Panel>}

    {tab==='wallet'&&<Panel title="Audited wallet control">
      <p className="admin-copy">All balance changes use the atomic financial function and create an audit record. Positive amounts credit; negative amounts debit.</p>
      <label className="block text-sm opacity-80 mb-2">Select user
       <select className="account-form mt-1 w-full" value={selectedUser?.id||''} onChange={e=>selectUser(data.profiles.find((u:any)=>u.id===e.target.value))}>
        <option value="">Choose a user…</option>{data.profiles.map((u:any)=><option key={u.id} value={u.id}>{u.name||'Unnamed'} · {u.username||u.id}</option>)}
       </select>
      </label>
      {selectedUser&&<div className="rounded-2xl border border-white/10 bg-black/20 p-4 mb-4">
       <div className="font-semibold">{selectedUser.name||'Unnamed'} · {selectedUser.username||'No username'}</div>
       <div className="text-xs opacity-60 mt-1">{selectedUser.id}</div>
       <div className="grid gap-3 sm:grid-cols-3 mt-3"><div><span className="text-xs opacity-60">Available</span><strong className="block">{naira(walletForUser?.available_minor||0)}</strong></div><div><span className="text-xs opacity-60">Invested</span><strong className="block">{naira(walletForUser?.invested_minor||0)}</strong></div><div><span className="text-xs opacity-60">Profit</span><strong className="block">{naira(walletForUser?.profit_minor||0)}</strong></div></div>
      </div>}
      <div className="grid gap-2 sm:grid-cols-3">
       <input className="account-form" placeholder="Amount ₦ (use - to debit)" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/>
       <input className="account-form" placeholder="Reason (required)" value={reason} onChange={e=>setReason(e.target.value)}/>
       <button type="button" className="primary-button" disabled={Boolean(busy)||!selectedUser} onClick={()=>{
         const n=Number(amount); if(!selectedUser)return setError('Select a user first.'); if(!Number.isFinite(n)||n===0)return setError('Enter a non-zero amount.'); if(!reason.trim())return setError('Enter a reason before saving.')
         void act('balance',()=>adjustUserBalance({userId:selectedUser.id,amountMinor:Math.round(n*100),reason:reason.trim()}),'Wallet adjustment saved.')
       }}><Save size={15}/>Apply adjustment</button>
      </div>
      <div className="mt-5 border-t border-white/10 pt-5">
       <h3 className="font-semibold mb-3">Edit selected profile</h3>
       <div className="grid gap-2 sm:grid-cols-2"><input className="account-form" placeholder="Full name" value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/><input className="account-form" placeholder="Username" value={profile.username} onChange={e=>setProfile({...profile,username:e.target.value})}/></div>
       <button type="button" className="secondary-button mt-3" disabled={Boolean(busy)||!selectedUser} onClick={()=>act('profile',()=>updateUserProfile({id:selectedUser.id,name:profile.name,username:profile.username}),'Profile saved.')}>Save profile</button>
      </div>
    </Panel>}

    {tab==='deposits'&&<Panel title="All deposits">
      {data.deposits.map((x:any)=><Row key={x.id} title={x.status+' · '+naira(x.amount_minor)} meta={x.user_id+' · '+date(x.created_at)}>
       {x.status==='PENDING'&&<><button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>reviewDeposit({id:x.id,status:'APPROVED'}),'Deposit approved.')}>Approve</button><button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>reviewDeposit({id:x.id,status:'REJECTED',reason}),'Deposit rejected.')}>Reject</button></>}
       {x.proof_url&&<a className="secondary-button" href={`/api/deposit-proof?pathname=${encodeURIComponent(x.proof_url)}`} target="_blank" rel="noreferrer">View proof</a>}
      </Row>)}
      {!data.deposits.length&&<Empty text="No deposits yet."/>}
    </Panel>}

    {tab==='withdrawals'&&<Panel title="All withdrawals">
      {data.withdrawals.map((x:any)=><Row key={x.id} title={x.status+' · '+naira(x.amount_minor)} meta={x.user_id+' · net '+naira(x.net_minor)+' · '+date(x.created_at)}>
       {x.status==='PENDING'&&<><button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>reviewWithdrawal(x.id,'APPROVED',reason),'Withdrawal approved.')}>Approve</button><button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>reviewWithdrawal(x.id,'REJECTED',reason),'Withdrawal rejected.')}>Reject</button></>}
      </Row>)}
      {!data.withdrawals.length&&<Empty text="No withdrawals yet."/>}
    </Panel>}

    {tab==='investments'&&<Panel title="Investment lifecycle">
      <p className="admin-copy mb-4">Investments are state-transition records. There is no hard-delete control. Due active investments can be processed through the atomic maturity function.</p>
      {data.investments.map((x:any)=><Row key={x.id} title={x.plan_name_snapshot+' · '+x.status} meta={x.user_id+' · principal '+naira(x.principal_minor)+' · maturity '+naira(x.maturity_minor)+' · '+date(x.matures_at)}>
       {x.status==='ACTIVE'&&new Date(x.matures_at).getTime()<=Date.now()&&<button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>processInvestmentMaturity(x.id),'Investment maturity processed.')}>Process maturity</button>}
       {x.status==='ACTIVE'&&new Date(x.matures_at).getTime()>Date.now()&&<span className="secondary-button"><Clock3 size={15}/> Not due</span>}
      </Row>)}
      {!data.investments.length&&<Empty text="No investments yet."/>}
    </Panel>}

    {tab==='plans'&&<div className="grid gap-4 lg:grid-cols-[1fr_390px]">
      <Panel title="Investment plans">{data.plans.map((x:any)=><Row key={x.id} title={x.name+' · '+(x.active&&!x.deleted_at?'LIVE':'ARCHIVED')} meta={x.category+' · '+x.duration_days+' days · '+(Number(x.return_bps)/100).toFixed(2)+'% · '+naira(x.minimum_minor)+'–'+naira(x.maximum_minor)}>
       <button type="button" className="secondary-button" onClick={()=>setPlan({id:x.id,name:x.name,description:x.description,category:x.category,minimumMinor:Number(x.minimum_minor),maximumMinor:Number(x.maximum_minor),returnBps:Number(x.return_bps),durationDays:Number(x.duration_days),terms:x.terms,purchaseBonusMinor:Number(x.purchase_bonus_minor||0),active:x.active,displayOrder:x.display_order})}>Edit</button>
       <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>archivePlan(x.id,!x.deleted_at,'Admin plan status change'),x.deleted_at?'Plan restored.':'Plan archived.')}>{x.deleted_at?<RotateCcw size={15}/>:<Archive size={15}/>} {x.deleted_at?'Restore':'Archive'}</button>
      </Row>)}<button type="button" className="secondary-button mt-3" onClick={()=>setPlan({...emptyPlan})}>New plan</button></Panel>
      <Panel title={plan.id?'Edit plan':'Create plan'}><div className="grid gap-2">
       <input className="account-form" placeholder="Plan name" value={plan.name} onChange={e=>setPlan({...plan,name:e.target.value})}/>
       <textarea className="account-form min-h-20" placeholder="Description" value={plan.description} onChange={e=>setPlan({...plan,description:e.target.value})}/>
       <select className="account-form" value={plan.category} onChange={e=>setPlan({...plan,category:e.target.value})}><option>DAILY</option><option>WEEKLY</option><option>MONTHLY</option></select>
       {[
        ['minimumMinor','Minimum ₦'],['maximumMinor','Maximum ₦'],['returnBps','Return BPS'],['durationDays','Duration days'],['purchaseBonusMinor','Purchase bonus ₦ (minor units)'],['displayOrder','Display order']
       ].map((x:any)=><input key={x[0]} className="account-form" type="number" placeholder={x[1]} value={x[0]==='purchaseBonusMinor'?Number(plan[x[0]||0])/100:plan[x[0]]} onChange={e=>setPlan({...plan,[x[0]:x[0]==='purchaseBonusMinor'?Math.round(Number(e.target.value)*100):Number(e.target.value)})}/> )}
       <textarea className="account-form min-h-24" placeholder="Terms" value={plan.terms} onChange={e=>setPlan({...plan,terms:e.target.value})}/>
       <label className="admin-checkbox"><input type="checkbox" checked={plan.active} onChange={e=>setPlan({...plan,active:e.target.checked})}/> Active</label>
       <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>{
         if(!plan.name.trim()||!plan.description.trim()||!plan.terms.trim())return setError('Plan name, description and terms are required.')
         if(plan.maximumMinor<plan.minimumMinor)return setError('Maximum amount must be at least the minimum.')
         void act('plan',()=>savePlan(plan),plan.id?'Plan updated.':'Plan created.')
       }}><Save size={15}/>Save plan</button>
      </div></Panel>
    </div>}

    {tab==='referrals'&&<Panel title="Referral records">
      <p className="admin-copy mb-4">Referral status and reward values are editable and audited. This control does not silently credit a wallet; financial credits must use the audited wallet adjustment path.</p>
      {data.referrals.map((x:any)=><Row key={x.id} title={x.status+' · '+naira(x.reward_minor)} meta={x.referrer_user_id+' → '+x.referred_user_id+' · '+date(x.created_at)}>
       <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>updateReferral(x.id,'QUALIFIED',Number(x.reward_minor||0),'Admin marked referral qualified'),'Referral marked qualified.')}>Mark qualified</button>
       <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>updateReferral(x.id,'PENDING',Number(x.reward_minor||0),'Admin reset referral status'),'Referral reset.')}>Reset</button>
      </Row>)}
      {!data.referrals.length&&<Empty text="No referrals yet."/>}
    </Panel>}

    {tab==='lucky'&&<div className="grid gap-4 lg:grid-cols-[1fr_390px]">
      <Panel title="Lucky Wish draws">{data.draws.map((x:any)=><Row key={x.id} title={x.status+' · '+x.title} meta={x.reward_type+' · '+naira(x.reward_minor||0)+' · '+date(x.closes_at)}>
       <button type="button" className="secondary-button" onClick={()=>setDraw({id:x.id,title:x.title,description:x.description||'',rewardType:x.reward_type,rewardMinor:Number(x.reward_minor||0),alternateReward:x.alternate_reward||'',entryCostMinor:Number(x.entry_cost_minor||0),opensAt:new Date(x.opens_at).toISOString().slice(0,16),closesAt:new Date(x.closes_at).toISOString().slice(0,16)})}>Edit</button>
       <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>toggleDraw(x.id,x.status!=='OPEN'),x.status==='OPEN'?'Draw closed.':'Draw opened.')}>{x.status==='OPEN'?'Close':'Open'}</button>
      </Row>)}{!data.draws.length&&<Empty text="No draws yet."/>}</Panel>
      <Panel title={draw.id?'Edit draw':'Create draw'}><div className="grid gap-2">
       <input className="account-form" placeholder="Title" value={draw.title} onChange={e=>setDraw({...draw,title:e.target.value})}/>
       <textarea className="account-form min-h-20" placeholder="Description" value={draw.description} onChange={e=>setDraw({...draw,description:e.target.value})}/>
       <select className="account-form" value={draw.rewardType} onChange={e=>setDraw({...draw,rewardType:e.target.value})}><option>CASH</option><option>ALTERNATE</option></select>
       <input className="account-form" type="number" placeholder="Cash reward ₦" value={draw.rewardMinor/100} onChange={e=>setDraw({...draw,rewardMinor:Math.round(Number(e.target.value)*100)})}/>
       <input className="account-form" placeholder="Alternative reward" value={draw.alternateReward} onChange={e=>setDraw({...draw,alternateReward:e.target.value})}/>
       <input className="account-form" type="number" placeholder="Entry cost ₦" value={draw.entryCostMinor/100} onChange={e=>setDraw({...draw,entryCostMinor:Math.round(Number(e.target.value)*100)})}/>
       <label className="text-sm opacity-80">Opens<input className="account-form mt-1 w-full" type="datetime-local" value={draw.opensAt} onChange={e=>setDraw({...draw,opensAt:e.target.value})}/></label>
       <label className="text-sm opacity-80">Closes<input className="account-form mt-1 w-full" type="datetime-local" value={draw.closesAt} onChange={e=>setDraw({...draw,closesAt:e.target.value})}/></label>
       <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>{if(!draw.title.trim()||!draw.opensAt||!draw.closesAt)return setError('Title, opening time and closing time are required.');void act('draw',()=>draw.id?updateDraw(draw):createDraw(draw),draw.id?'Draw updated.':'Draw created.')}}><Save size={15}/>{draw.id?'Save draw':'Create draw'}</button>
       {draw.id&&<button type="button" className="secondary-button" onClick={()=>setDraw({...emptyDraw})}>New draw</button>}
      </div></Panel>
    </div>}

    {tab==='notifications'&&<Panel title="Send notifications"><div className="grid gap-2 max-w-xl">
      <select className="account-form" value={msg.userId} onChange={e=>setMsg({...msg,userId:e.target.value})}><option value="">All active users</option>{data.profiles.map((u:any)=><option key={u.id} value={u.id}>{u.name||'Unnamed'} · {u.username||u.id}</option>)}</select>
      <input className="account-form" placeholder="Title" value={msg.title} onChange={e=>setMsg({...msg,title:e.target.value})}/>
      <textarea className="account-form min-h-32" placeholder="Message" value={msg.body} onChange={e=>setMsg({...msg,body:e.target.value})}/>
      <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>{if(!msg.title.trim()||!msg.body.trim())return setError('Notification title and message are required.');void act('notify',()=>sendAdminNotification(msg.userId||null,msg.title,msg.body,msg.type),'Notification sent.')}}><Send size={15}/>Send notification</button>
    </div></Panel>}

    {tab==='accounts'&&<Panel title="Payment accounts">
      <a className="primary-button inline-flex" href="/admin/accounts">Open bank-account editor</a>
      {data.accounts.map((x:any)=><Row key={x.id} title={x.bank_name+' · '+(x.active?'VISIBLE':'HIDDEN')} meta={x.account_name+' · '+x.account_number}>
       <a className="secondary-button" href="/admin/accounts">Edit</a>
       <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>setPaymentAccountActive(x.id,!x.active),x.active?'Account hidden.':'Account activated.')}>{x.active?'Hide':'Activate'}</button>
      </Row>)}
    </Panel>}

    {tab==='payouts'&&<Panel title="User payout accounts">
      {data.payouts.map((x:any)=><Row key={x.id} title={x.bank_name+' · '+x.account_name+(x.deleted_at?' · ARCHIVED':'')} meta={x.user_id+' · '+x.account_number+(x.is_default?' · DEFAULT':'')}>
       {x.deleted_at
        ?<button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>restorePayout(x.id,'Admin restored payout account'),'Payout account restored.') }><RotateCcw size={15}/>Restore</button>
        :<button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>archivePayout(x.id,'Admin archived payout account'),'Payout account archived.')}><Archive size={15}/>Archive</button>}
      </Row>)}
      {!data.payouts.length&&<Empty text="No payout accounts yet."/>}
    </Panel>}

    {tab==='ledger'&&<Panel title="Financial ledger"><p className="admin-copy mb-3">Ledger entries are intentionally read-only. Financial history is not hard-deleted.</p>{data.ledger.map((x:any)=><Row key={x.id} title={x.type+' · '+x.direction+' · '+naira(x.amount_minor)} meta={x.user_id+' · '+x.reference+' · '+date(x.created_at)}/>)}</Panel>}
    {tab==='audit'&&<Panel title="Audit log">{data.audits.map((x:any)=><Row key={x.id} title={x.action} meta={(x.actor_id||'system')+' · '+x.target_type+' · '+date(x.created_at)}>{x.reason&&<span className="text-xs opacity-60">{x.reason}</span>}</Row>)}</Panel>}

    {tab==='settings'&&<Panel title="Withdrawal policy"><div className="grid gap-3 max-w-xl">
      <input className="account-form" value={policy.timezone} onChange={e=>setPolicy({...policy,timezone:e.target.value})} placeholder="Timezone"/>
      <div><div className="text-sm opacity-70 mb-2">Allowed withdrawal days</div><div className="flex flex-wrap gap-2">{days.map(d=><label key={d} className="admin-checkbox"><input type="checkbox" checked={policy.enabledDays.includes(d)} onChange={e=>setPolicy({...policy,enabledDays:e.target.checked?[...policy.enabledDays,d]:policy.enabledDays.filter((x:string)=>x!==d)})}/>{d}</label>)}</div></div>
      <div className="grid grid-cols-2 gap-2"><input className="account-form" type="time" value={policy.startTime} onChange={e=>setPolicy({...policy,startTime:e.target.value})}/><input className="account-form" type="time" value={policy.endTime} onChange={e=>setPolicy({...policy,endTime:e.target.value})}/></div>
      <input className="account-form" type="number" value={policy.minimumMinor/100} onChange={e=>setPolicy({...policy,minimumMinor:Math.round(Number(e.target.value)*100)})} placeholder="Minimum withdrawal ₦"/>
      <input className="account-form" type="number" value={policy.maximumMinor==null?'':policy.maximumMinor/100} onChange={e=>setPolicy({...policy,maximumMinor:e.target.value===''?null:Math.round(Number(e.target.value)*100)})} placeholder="Maximum withdrawal ₦"/>
      <label className="admin-checkbox"><input type="checkbox" checked={policy.enabled} onChange={e=>setPolicy({...policy,enabled:e.target.checked})}/> Withdrawals enabled</label>
      <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>{if(!policy.enabledDays.length)return setError('Select at least one withdrawal day.');if(policy.maximumMinor!==null&&policy.maximumMinor<policy.minimumMinor)return setError('Maximum withdrawal must be at least minimum.');void act('policy',()=>savePolicy(policy),'Withdrawal policy saved.')}}><Save size={15}/>Save policy</button>
    </div></Panel>}
   </div>
  </div>
 </main>
}

function Panel(p:any){return <section className="rounded-3xl border border-white/10 bg-white/5 p-5"><h2 className="mb-4 text-lg font-semibold">{p.title}</h2>{p.children}</section>}
function Row(p:any){return <article className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"><div className="min-w-0"><strong className="block break-words">{p.title}</strong><span className="text-xs opacity-60 break-all">{p.meta}</span></div><div className="flex flex-wrap gap-2">{p.children}</div></article>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm opacity-60">{text}</div>}
