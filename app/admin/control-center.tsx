'use client'

import { useEffect,useMemo,useState } from 'react'
import { ArrowLeft, RefreshCw, Shield, Users, Wallet, TrendingUp, Landmark, Gift, Bell, ScrollText, Settings, Archive, RotateCcw, Save, Send, Search, CheckCircle2, Clock3, Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  getAdminCenter,savePlan,saveMarquee,archiveMarquee,deleteMarquee,archivePlan,setUserState,savePolicy,saveDepositPolicy,sendAdminNotification,
  createDraw,updateDraw,toggleDraw,updateReferral,archivePayout,restorePayout,
  updateUserProfile,processInvestmentMaturity
} from '@/app/actions/admin-center'
import { adjustUserBalance,reviewDeposit } from '@/app/actions/admin'
import { reviewWithdrawal } from '@/app/actions/control'
import { setPaymentAccountActive } from '@/app/actions/payment-accounts'

const naira=(m:number)=>'₦'+(Number(m||0)/100).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})
const date=(v:any)=>v ? new Date(v).toISOString().replace('T',' ').slice(0,16)+' UTC' : '—'
const days=['MON','TUE','WED','THU','FRI','SAT','SUN']

const emptyPlan={name:'',description:'',category:'MONTHLY',minimumMinor:1000000,maximumMinor:1000000,returnMinor:100000,durationDays:30,terms:'',purchaseBonusMinor:0,active:true,displayOrder:1}
const emptyDraw={title:'',description:'',rewardType:'CASH',rewardMinor:0,alternateReward:'',entryCostMinor:0,opensAt:'',closesAt:''}
const emptyPolicy={timezone:'Africa/Lagos',enabledDays:['MON','TUE','WED','THU','FRI'],startTime:'09:00',endTime:'17:00',minimumMinor:100000,maximumMinor:null,enabled:true}
const emptyDepositPolicy={timezone:'Africa/Lagos',enabledDays:['MON','TUE','WED','THU','FRI'],startTime:'09:00',endTime:'17:00',enabled:true}

export default function ControlCenter(){
 const router=useRouter()
 const [data,setData]=useState<any>(null)
 const [tab,setTab]=useState('overview')
 const [busy,setBusy]=useState('')
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const [q,setQ]=useState('')
 const [manageOpen,setManageOpen]=useState(false)
 const [marqueeManageOpen,setMarqueeManageOpen]=useState(false)
 const [selectedUser,setSelectedUser]=useState<any>(null)
 const [amount,setAmount]=useState('')
 const [reason,setReason]=useState('')
 const [profile,setProfile]=useState({name:'',username:''})
 const [plan,setPlan]=useState<any>(emptyPlan)
 const [policy,setPolicy]=useState<any>(emptyPolicy)
 const [depositPolicy,setDepositPolicy]=useState<any>(emptyDepositPolicy)
 const [msg,setMsg]=useState<any>({userId:'',title:'',body:'',type:'SYSTEM'})
 const [draw,setDraw]=useState<any>(emptyDraw)
 const [copied,setCopied]=useState('')
 const [referralRewards,setReferralRewards]=useState<Record<string,string>>({})
 const [confirmPlan,setConfirmPlan]=useState<any>(null)
 const [marqueeOpen,setMarqueeOpen]=useState(false)
 const [marquee,setMarquee]=useState<any>({title:'',content:'',kind:'HIGHLIGHT',userId:null,active:true})
 const [adminScrolling,setAdminScrolling]=useState(false)

 const load=async()=>{
   try{
     setError(''); const d=await getAdminCenter(); setData(d)
     setSelectedUser((current:any)=>current ? (d.profiles||[]).find((u:any)=>u.id===current.id)||current : current)
     if(d.settings)setPolicy({
       timezone:d.settings.timezone,enabledDays:d.settings.enabled_days||[],
       startTime:d.settings.start_time,endTime:d.settings.end_time,
       minimumMinor:Number(d.settings.minimum_minor||100000),
       maximumMinor:d.settings.maximum_minor==null?null:Number(d.settings.maximum_minor),
       enabled:Boolean(d.settings.enabled)
     })
     if(d.depositSettings)setDepositPolicy({
       timezone:d.depositSettings.timezone,enabledDays:d.depositSettings.enabled_days||[],
       startTime:d.depositSettings.start_time,endTime:d.depositSettings.end_time,
       enabled:Boolean(d.depositSettings.enabled)
     })
   }catch(e){setError(e instanceof Error?e.message:'Unable to load control center.')}
 }
 useEffect(()=>{void load()},[])

 useEffect(()=>{ const onScroll=()=>{setAdminScrolling(true);window.clearTimeout((window as any).__qxScroll);(window as any).__qxScroll=window.setTimeout(()=>setAdminScrolling(false),420)};window.addEventListener('scroll',onScroll,{passive:true});return()=>window.removeEventListener('scroll',onScroll)},[])

 useEffect(()=>{
   const timer=window.setInterval(()=>{ if(!busy) void load() },15000)
   return()=>window.clearInterval(timer)
 },[busy])

 const act=async(k:string,fn:()=>Promise<any>,message?:string)=>{
   try{setBusy(k);setError('');setSuccess('');await fn();await load();if(message)setSuccess(message)}
   catch(e){setError(e instanceof Error?e.message:'Action failed. Nothing was changed.')}
   finally{setBusy('')}
 }

 const users=useMemo(()=>{const term=q.trim().toLowerCase(); return data?.profiles?.filter((u:any)=>!term||[u.name,u.username,u.email,u.id].some((v:any)=>String(v||'').toLowerCase().includes(term)))||[]},[data,q])
 const walletForUser=selectedUser?data?.wallets?.find((w:any)=>w.user_id===selectedUser.id):null
 const copyValue=async(key:string,value:any)=>{try{await navigator.clipboard.writeText(String(value??''));setCopied(key);window.setTimeout(()=>setCopied(''),1400)}catch{setError('Unable to copy this value. You can select the text manually.')}}
 const withdrawalAccount=(x:any)=>x.payout_account_snapshot||data.payouts?.find((p:any)=>p.id===x.payout_account_id)||{}

 function selectUser(u:any){
   if(!u){setSelectedUser(null);setProfile({name:'',username:''});return}
   setSelectedUser(u); setProfile({name:u.name||'',username:u.username||''}); setTab('wallet'); setError(''); setSuccess(''); setManageOpen(true)
 }

 if(!data)return <main className="admin-shell"><div className="admin-frame"><div className="admin-shimmer"><div className="shimmer-block shimmer-title"/><div className="shimmer-grid">{Array.from({length:5}).map((_,i)=><div className="shimmer-block shimmer-stat" key={i}/>)}</div><div className="shimmer-block shimmer-panel"/><div className="shimmer-block shimmer-panel"/></div></div></main>

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
     <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>window.location.reload()} title="Refresh the entire admin system"><RefreshCw size={16}/> Refresh</button>
    </div>
    <nav aria-label="Admin sections" className="mt-4 flex gap-2 overflow-x-auto pb-1">
     {tabs.map(([id,label,I])=><button type="button" key={id} onClick={()=>{setTab(id);setError('');setSuccess('')}} className={tab===id?'primary-button whitespace-nowrap':'secondary-button whitespace-nowrap'}><I size={15}/>{label}</button>)}
    </nav>
   </header>

   {error&&<div className="admin-error m-4" role="alert"><Shield size={17}/><span>{error}</span></div>}
   {success&&<div className="admin-success m-4" role="status"><CheckCircle2 size={17}/><span>{success}</span></div>}

   <section className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
    {[
      ['Registered users',data.registeredUserCount],
      ['Admin accounts',data.adminAccountCount],
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

    {tab==='users'&&<Panel title={`Registered accounts · ${data.registeredAccountCount}`}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row"><div className="flex flex-1 gap-2"><Search className="mt-3 opacity-50"/><input className="account-form flex-1" placeholder="Search name, username, email or UUID" value={q} onChange={e=>setQ(e.target.value)}/></div><div className="secondary-button"><Users size={15}/>{users.length} shown · {data.registeredUserCount} users · {data.adminAccountCount} admins</div></div>
      {users.map((u:any)=><Row key={u.id} title={(u.name||'Unnamed')+' · '+(u.username||'No username')} meta={(u.email||'No email')+' · '+u.status+' · '+u.role+' · '+u.id+' · '+naira(u.available_balance_minor)+' available · '+naira(u.invested_balance_minor)+' invested · '+naira(u.profit_balance_minor)+' profit'}>
       <button type="button" className="primary-button" onClick={()=>selectUser(u)}>Manage</button>
       {u.status==='ACTIVE'
        ?<button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(u.id,()=>setUserState(u.id,'SUSPENDED','Administrative suspension'),'User suspended.')}>Suspend</button>
        :<button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(u.id,()=>setUserState(u.id,'ACTIVE','Administrative restoration'),'User activated.')}>Activate</button>}
      </Row>)}
'use client'

import { useEffect,useMemo,useState } from 'react'
import { ArrowLeft, RefreshCw, Shield, Users, Wallet, TrendingUp, Landmark, Gift, Bell, ScrollText, Settings, Archive, RotateCcw, Save, Send, Search, CheckCircle2, Clock3, Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  getAdminCenter,savePlan,saveMarquee,archiveMarquee,deleteMarquee,archivePlan,setUserState,savePolicy,saveDepositPolicy,sendAdminNotification,
  createDraw,updateDraw,toggleDraw,updateReferral,archivePayout,restorePayout,
  updateUserProfile,processInvestmentMaturity
} from '@/app/actions/admin-center'
import { adjustUserBalance,reviewDeposit } from '@/app/actions/admin'
import { reviewWithdrawal } from '@/app/actions/control'
import { setPaymentAccountActive } from '@/app/actions/payment-accounts'

const naira=(m:number)=>'₦'+(Number(m||0)/100).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})
const date=(v:any)=>v ? new Date(v).toISOString().replace('T',' ').slice(0,16)+' UTC' : '—'
const days=['MON','TUE','WED','THU','FRI','SAT','SUN']

const emptyPlan={name:'',description:'',category:'MONTHLY',minimumMinor:1000000,maximumMinor:1000000,returnMinor:100000,durationDays:30,terms:'',purchaseBonusMinor:0,active:true,displayOrder:1}
const emptyDraw={title:'',description:'',rewardType:'CASH',rewardMinor:0,alternateReward:'',entryCostMinor:0,opensAt:'',closesAt:''}
const emptyPolicy={timezone:'Africa/Lagos',enabledDays:['MON','TUE','WED','THU','FRI'],startTime:'09:00',endTime:'17:00',minimumMinor:100000,maximumMinor:null,enabled:true}
const emptyDepositPolicy={timezone:'Africa/Lagos',enabledDays:['MON','TUE','WED','THU','FRI'],startTime:'09:00',endTime:'17:00',enabled:true}

export default function ControlCenter(){
 const router=useRouter()
 const [data,setData]=useState<any>(null)
 const [tab,setTab]=useState('overview')
 const [busy,setBusy]=useState('')
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const [q,setQ]=useState('')
 const [manageOpen,setManageOpen]=useState(false)
 const [marqueeManageOpen,setMarqueeManageOpen]=useState(false)
 const [selectedUser,setSelectedUser]=useState<any>(null)
 const [amount,setAmount]=useState('')
 const [reason,setReason]=useState('')
 const [profile,setProfile]=useState({name:'',username:''})
 const [plan,setPlan]=useState<any>(emptyPlan)
 const [policy,setPolicy]=useState<any>(emptyPolicy)
 const [depositPolicy,setDepositPolicy]=useState<any>(emptyDepositPolicy)
 const [msg,setMsg]=useState<any>({userId:'',title:'',body:'',type:'SYSTEM'})
 const [draw,setDraw]=useState<any>(emptyDraw)
 const [copied,setCopied]=useState('')
 const [referralRewards,setReferralRewards]=useState<Record<string,string>>({})
 const [confirmPlan,setConfirmPlan]=useState<any>(null)
 const [marqueeOpen,setMarqueeOpen]=useState(false)
 const [marquee,setMarquee]=useState<any>({title:'',content:'',kind:'HIGHLIGHT',userId:null,active:true})
 const [adminScrolling,setAdminScrolling]=useState(false)

 const load=async()=>{
   try{
     setError(''); const d=await getAdminCenter(); setData(d)
     setSelectedUser((current:any)=>current ? (d.profiles||[]).find((u:any)=>u.id===current.id)||current : current)
     if(d.settings)setPolicy({
       timezone:d.settings.timezone,enabledDays:d.settings.enabled_days||[],
       startTime:d.settings.start_time,endTime:d.settings.end_time,
       minimumMinor:Number(d.settings.minimum_minor||100000),
       maximumMinor:d.settings.maximum_minor==null?null:Number(d.settings.maximum_minor),
       enabled:Boolean(d.settings.enabled)
     })
     if(d.depositSettings)setDepositPolicy({
       timezone:d.depositSettings.timezone,enabledDays:d.depositSettings.enabled_days||[],
       startTime:d.depositSettings.start_time,endTime:d.depositSettings.end_time,
       enabled:Boolean(d.depositSettings.enabled)
     })
   }catch(e){setError(e instanceof Error?e.message:'Unable to load control center.')}
 }
 useEffect(()=>{void load()},[])

 useEffect(()=>{ const onScroll=()=>{setAdminScrolling(true);window.clearTimeout((window as any).__qxScroll);(window as any).__qxScroll=window.setTimeout(()=>setAdminScrolling(false),420)};window.addEventListener('scroll',onScroll,{passive:true});return()=>window.removeEventListener('scroll',onScroll)},[])

 useEffect(()=>{
   const timer=window.setInterval(()=>{ if(!busy) void load() },15000)
   return()=>window.clearInterval(timer)
 },[busy])

 const act=async(k:string,fn:()=>Promise<any>,message?:string)=>{
   try{setBusy(k);setError('');setSuccess('');await fn();await load();if(message)setSuccess(message)}
   catch(e){setError(e instanceof Error?e.message:'Action failed. Nothing was changed.')}
   finally{setBusy('')}
 }

 const users=useMemo(()=>{const term=q.trim().toLowerCase(); return data?.profiles?.filter((u:any)=>!term||[u.name,u.username,u.email,u.id].some((v:any)=>String(v||'').toLowerCase().includes(term)))||[]},[data,q])
 const walletForUser=selectedUser?data?.wallets?.find((w:any)=>w.user_id===selectedUser.id):null
 const copyValue=async(key:string,value:any)=>{try{await navigator.clipboard.writeText(String(value??''));setCopied(key);window.setTimeout(()=>setCopied(''),1400)}catch{setError('Unable to copy this value. You can select the text manually.')}}
 const withdrawalAccount=(x:any)=>x.payout_account_snapshot||data.payouts?.find((p:any)=>p.id===x.payout_account_id)||{}

 function selectUser(u:any){
   if(!u){setSelectedUser(null);setProfile({name:'',username:''});return}
   setSelectedUser(u); setProfile({name:u.name||'',username:u.username||''}); setTab('wallet'); setError(''); setSuccess(''); setManageOpen(true)
 }

 if(!data)return <main className="admin-shell"><div className="admin-frame"><div className="admin-shimmer"><div className="shimmer-block shimmer-title"/><div className="shimmer-grid">{Array.from({length:5}).map((_,i)=><div className="shimmer-block shimmer-stat" key={i}/>)}</div><div className="shimmer-block shimmer-panel"/><div className="shimmer-block shimmer-panel"/></div></div></main>

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
     <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>window.location.reload()} title="Refresh the entire admin system"><RefreshCw size={16}/> Refresh</button>
    </div>
    <nav aria-label="Admin sections" className="mt-4 flex gap-2 overflow-x-auto pb-1">
     {tabs.map(([id,label,I])=><button type="button" key={id} onClick={()=>{setTab(id);setError('');setSuccess('')}} className={tab===id?'primary-button whitespace-nowrap':'secondary-button whitespace-nowrap'}><I size={15}/>{label}</button>)}
    </nav>
   </header>

   {error&&<div className="admin-error m-4" role="alert"><Shield size={17}/><span>{error}</span></div>}
   {success&&<div className="admin-success m-4" role="status"><CheckCircle2 size={17}/><span>{success}</span></div>}

   <section className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
    {[
      ['Registered users',data.registeredUserCount],
      ['Admin accounts',data.adminAccountCount],
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

    {tab==='users'&&<Panel title={`Registered accounts · ${data.registeredAccountCount}`}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row"><div className="flex flex-1 gap-2"><Search className="mt-3 opacity-50"/><input className="account-form flex-1" placeholder="Search name, username, email or UUID" value={q} onChange={e=>setQ(e.target.value)}/></div><div className="secondary-button"><Users size={15}/>{users.length} shown · {data.registeredUserCount} users · {data.adminAccountCount} admins</div></div>
      {users.map((u:any)=><Row key={u.id} title={(u.name||'Unnamed')+' · '+(u.username||'No username')} meta={(u.email||'No email')+' · '+u.status+' · '+u.role+' · '+u.id+' · '+naira(u.available_balance_minor)+' available · '+naira(u.invested_balance_minor)+' invested · '+naira(u.profit_balance_minor)+' profit'}>
       <button type="button" className="primary-button" onClick={()=>selectUser(u)}>Manage</button>
       {u.status==='ACTIVE'
        ?<button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(u.id,()=>setUserState(u.id,'SUSPENDED','Administrative suspension'),'User suspended.')}>Suspend</button>
        :<button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(u.id,()=>setUserState(u.id,'ACTIVE','Administrative restoration'),'User activated.')}>Activate</button>}
      </Row>)}
      {selectedUser&&<div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5">
       <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="text-xs uppercase tracking-wider opacity-50">Managed user</div><h3 className="mt-1 text-xl font-semibold">{selectedUser.name||'Unnamed'} · {selectedUser.username||'No username'}</h3><p className="text-sm opacity-60">{selectedUser.email||'No email'} · {selectedUser.status} · {selectedUser.role}</p></div>
        <button type="button" className="secondary-button" onClick={()=>selectUser(null)}>Close</button>
       </div>
       <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 p-4"><span className="text-xs opacity-60">Available balance</span><strong className="mt-1 block text-lg">{naira(selectedUser.available_balance_minor)}</strong></div>
        <div className="rounded-2xl border border-white/10 p-4"><span className="text-xs opacity-60">Invested balance</span><strong className="mt-1 block text-lg">{naira(selectedUser.invested_balance_minor)}</strong></div>
        <div className="rounded-2xl border border-white/10 p-4"><span className="text-xs opacity-60">Profit</span><strong className="mt-1 block text-lg">{naira(selectedUser.profit_balance_minor)}</strong></div>
        <div className="rounded-2xl border border-white/10 p-4"><span className="text-xs opacity-60">Investments</span><strong className="mt-1 block text-lg">{selectedUser.total_investments_count} total · {selectedUser.active_investments_count} active</strong></div>
       </div>
       <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 p-4"><span className="text-xs opacity-60">Total referrals</span><strong className="mt-1 block text-lg">{selectedUser.referral_count}</strong></div>
        <div className="rounded-2xl border border-white/10 p-4"><span className="text-xs opacity-60">Verified referrals</span><strong className="mt-1 block text-lg">{selectedUser.verified_referral_count}</strong></div>
        <div className="rounded-2xl border border-white/10 p-4"><span className="text-xs opacity-60">Pending referrals</span><strong className="mt-1 block text-lg">{selectedUser.pending_referral_count}</strong></div>
        <div className="rounded-2xl border border-white/10 p-4"><span className="text-xs opacity-60">Referral earnings</span><strong className="mt-1 block text-lg">{naira(selectedUser.referral_earnings_minor)}</strong></div>
       </div>
       <div className="mt-5 border-t border-white/10 pt-5">
        <h4 className="font-semibold">Edit user profile</h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-2"><input className="account-form" placeholder="Full name" value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/><input className="account-form" placeholder="Username" value={profile.username} onChange={e=>setProfile({...profile,username:e.target.value})}/></div>
        <button type="button" className="secondary-button mt-3" disabled={Boolean(busy)} onClick={()=>act('profile-users',()=>updateUserProfile({id:selectedUser.id,name:profile.name,username:profile.username}),'User profile saved.')}>Save profile changes</button>
       </div>
       <div className="mt-5 border-t border-white/10 pt-5">
        <div className="mb-3 flex items-center justify-between"><h4 className="font-semibold">Recent user activity</h4><span className="text-xs opacity-50">Latest 2 ledger entries</span></div>
        <div className="space-y-2">
         {data.ledger.filter((x:any)=>x.user_id===selectedUser.id).slice(0,2).map((x:any)=><Row key={x.id} title={(x.type||'ACTIVITY').replaceAll('_',' ')+' · '+(x.direction==='CREDIT'?'+':'-')+naira(x.amount_minor)} meta={(x.status||'')+' · '+date(x.created_at)+' · '+(x.reference||'No reference')}/>)}
         {!data.ledger.some((x:any)=>x.user_id===selectedUser.id)&&<Empty text="No recent wallet activity for this user."/>}
        </div>
       </div>
      </div>}
    </Panel>}

    {tab==='wallet'&&<Panel title="Audited wallet control">
      <p className="admin-copy">All balance changes use the atomic financial function and create an audit record. Positive amounts credit; negative amounts debit.</p>
      <div className="mb-5 rounded-3xl border border-white/10 bg-black/20 p-4">
       <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold">All user balances</h3><p className="text-xs opacity-60">Live values from the wallet records. The list refreshes automatically every 15 seconds.</p></div><div className="secondary-button"><Users size={15}/>{users.length} accounts</div></div>
       <div className="space-y-2">
        {users.map((u:any)=><div key={u.id} className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] sm:items-center">
         <div className="min-w-0"><div className="truncate font-medium">{u.name||'Unnamed'} · {u.username||'No username'}</div><div className="truncate text-xs opacity-50">{u.email||u.id}</div></div>
         <div><div className="text-[10px] uppercase tracking-wider opacity-50">Available</div><div className="font-semibold">{naira(u.available_balance_minor)}</div></div>
         <div><div className="text-[10px] uppercase tracking-wider opacity-50">Invested</div><div className="font-semibold">{naira(u.invested_balance_minor)}</div></div>
         <div><div className="text-[10px] uppercase tracking-wider opacity-50">Profit</div><div className="font-semibold">{naira(u.profit_balance_minor)}</div></div>
         <button type="button" className="secondary-button" onClick={()=>selectUser(u)}>Manage</button>
        </div>)}
       </div>
      </div>
      <label className="block text-sm opacity-80 mb-2">Select user
       <select className="account-form mt-1 w-full" value={selectedUser?.id||''} onChange={e=>selectUser(data.profiles.find((u:any)=>u.id===e.target.value))}>
        <option value="">Choose a user…</option>{data.profiles.map((u:any)=><option key={u.id} value={u.id}>{u.name||'Unnamed'} · {u.username||u.id}</option>)}
       </select>
      </label>
      {selectedUser&&<div className="rounded-2xl border border-white/10 bg-black/20 p-4 mb-4">
       <div className="font-semibold">{selectedUser.name||'Unnamed'} · {selectedUser.username||'No username'}</div>
       <div className="text-xs opacity-60 mt-1">{selectedUser.email||'No email'} · {selectedUser.id}</div>
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
      {data.deposits.map((x:any)=>{
       const funding=data.accounts.find((a:any)=>a.id===x.payment_account_id)
       return <Row key={x.id} title={x.status+' · '+naira(x.amount_minor)} meta={x.user_id+' · '+date(x.created_at)}>
        <div className="w-full rounded-2xl border border-white/10 bg-black/30 p-4">
         <div className="mb-3 text-sm font-semibold">Submitted deposit details</div>
         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><div className="text-xs opacity-60">Amount</div><div className="mt-1 font-medium">{naira(x.amount_minor)}</div></div>
          <div><div className="text-xs opacity-60">Sender name</div><div className="mt-1 break-words font-medium">{x.sender_name||'—'}</div></div>
          <div><div className="text-xs opacity-60">Transfer reference</div><div className="mt-1 break-all font-medium">{x.transfer_reference||'—'}</div></div>
          <div><div className="text-xs opacity-60">Deposit-to account</div><div className="mt-1 break-words font-medium">{funding?funding.bank_name+' · '+funding.account_name+' · '+funding.account_number:'—'}</div></div>
         </div>
         <div className="mt-3 text-xs opacity-60">Proof file: {x.payment_proof_name||'—'}</div>
        </div>
        {x.status==='PENDING'&&(
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>reviewDeposit({id:x.id,status:'APPROVED'}),'Deposit approved.')}>Approve</button>
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>reviewDeposit({id:x.id,status:'REJECTED',reason}),'Deposit rejected.')}>Reject</button>
          </div>
        )}
        {x.proof_url&&<a className="secondary-button" href={`/api/deposit-proof?pathname=${encodeURIComponent(x.proof_url)}`} target="_blank" rel="noreferrer">View proof</a>}
       </Row>
      })}
      {!data.deposits.length&&<Empty text="No deposits yet."/>}
    </Panel>}

    {tab==='withdrawals'&&<Panel title="All withdrawals">
      {data.withdrawals.map((x:any)=>{
       const a=withdrawalAccount(x)
       const accountName=a.account_name||a.accountName||'—'
       const bankName=a.bank_name||a.bankName||'—'
       const accountNumber=a.account_number||a.accountNumber||'—'
       const copyBtn=(key:string,value:string,label:string)=><button type="button" className="secondary-button" aria-label={`Copy ${label}`} title={`Copy ${label}`} onClick={()=>copyValue(key,value)}>{copied===key?<Check size={15}/>:<Copy size={15}/>}<span>{copied===key?'Copied':label}</span></button>
       return <Row key={x.id} title={x.status+' · '+naira(x.amount_minor)} meta={x.user_id+' · net '+naira(x.net_minor)+' · '+date(x.created_at)}>
        <div className="w-full rounded-2xl border border-white/10 bg-black/30 p-4">
         <div className="mb-3 text-sm font-semibold">Submitted payout account</div>
         <div className="grid gap-3 sm:grid-cols-3">
          <div><div className="text-xs opacity-60">Account name</div><div className="mt-1 break-words font-medium">{accountName}</div><div className="mt-2">{copyBtn(x.id+':name',accountName,'Copy name')}</div></div>
          <div><div className="text-xs opacity-60">Bank</div><div className="mt-1 break-words font-medium">{bankName}</div><div className="mt-2">{copyBtn(x.id+':bank',bankName,'Copy bank')}</div></div>
          <div><div className="text-xs opacity-60">Account number</div><div className="mt-1 break-all font-medium">{accountNumber}</div><div className="mt-2">{copyBtn(x.id+':number',accountNumber,'Copy account number')}</div></div>
         </div>
         <div className="mt-3 border-t border-white/10 pt-3">
          <div className="text-xs opacity-60">Amount to pay</div>
          <div className="mt-1 text-lg font-semibold">{naira(x.net_minor)}</div>
          <div className="mt-2">{copyBtn(x.id+':amount',naira(x.net_minor),'Copy amount')}</div>
         </div>
         <p className="mt-3 text-xs opacity-50">The account details above are the snapshot submitted with this withdrawal request. Use these details for this payment even if the user's payout account is later changed.</p>
        </div>
        {x.status==='PENDING'&&(
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>reviewWithdrawal(x.id,'APPROVED',reason),'Withdrawal approved.')}>Approve</button>
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>reviewWithdrawal(x.id,'REJECTED',reason),'Withdrawal rejected.')}>Reject</button>
          </div>
        )}
       </Row>
      })}
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
      <Panel title="Investment plans">{data.plans.map((x:any)=><Row key={x.id} title={x.name+' · '+(x.active&&!x.deleted_at?'LIVE':'ARCHIVED')} meta={x.category+' · '+x.duration_days+' days · Earn '+naira(x.return_minor ?? 0)+' · Total '+naira(Number(x.minimum_minor||0)+Number(x.return_minor||0)+Number(x.purchase_bonus_minor||0))+' · '+naira(x.minimum_minor)+'–'+naira(x.maximum_minor)}>
       <button type="button" className="secondary-button" onClick={()=>setPlan({id:x.id,name:x.name,description:x.description,category:x.category,minimumMinor:Number(x.minimum_minor),maximumMinor:Number(x.maximum_minor),returnMinor:Number(x.return_minor ?? 0),durationDays:Number(x.duration_days),terms:x.terms,purchaseBonusMinor:Number(x.purchase_bonus_minor||0),active:x.active,displayOrder:x.display_order})}>Edit</button>
       <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>archivePlan(x.id,!x.deleted_at,'Admin plan status change'),x.deleted_at?'Plan restored.':'Plan archived.')}>{x.deleted_at?<RotateCcw size={15}/>:<Archive size={15}/>} {x.deleted_at?'Restore':'Archive'}</button>
      </Row>)}<button type="button" className="secondary-button mt-3" onClick={()=>setPlan({...emptyPlan})}>New plan</button></Panel>
      <Panel title={plan.id?'Edit plan':'Create plan'}><div className="grid gap-2">
       <input className="account-form" placeholder="Plan name" value={plan.name} onChange={e=>setPlan({...plan,name:e.target.value})}/>
       <textarea className="account-form min-h-20" placeholder="Description" value={plan.description} onChange={e=>setPlan({...plan,description:e.target.value})}/>
       <select className="account-form" value={plan.category} onChange={e=>setPlan({...plan,category:e.target.value})}><option>DAILY</option><option>WEEKLY</option><option>MONTHLY</option></select>
       {[
        ['minimumMinor','Minimum ₦'],['maximumMinor','Maximum ₦'],['returnMinor','Return earned ₦'],['durationDays','Duration days'],['purchaseBonusMinor','Purchase bonus ₦'],['displayOrder','Display order']
       ].map((x:any)=><input key={x[0]} className="account-form" type="number" placeholder={x[1]} value={['minimumMinor','maximumMinor','returnMinor','purchaseBonusMinor'].includes(x[0])?plan[x[0]]/100:plan[x[0]]} onChange={e=>setPlan({...plan,[x[0]]:['minimumMinor','maximumMinor','returnMinor','purchaseBonusMinor'].includes(x[0])?Math.round(Number(e.target.value)*100):Number(e.target.value)})}/> )}
       <textarea className="account-form min-h-24" placeholder="Terms" value={plan.terms} onChange={e=>setPlan({...plan,terms:e.target.value})}/>
       <label className="admin-checkbox"><input type="checkbox" checked={plan.active} onChange={e=>setPlan({...plan,active:e.target.checked})}/> Active</label>
       <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>{
         if(!plan.name.trim()||!plan.description.trim()||!plan.terms.trim())return setError('Plan name, description and terms are required.')
         if(plan.maximumMinor<plan.minimumMinor)return setError('Maximum amount must be at least the minimum.')
         setConfirmPlan({...plan})
       }}><Save size={15}/>Save plan</button>
      </div></Panel>
    </div>}

    {tab==='referrals'&&<Panel title="Referral records">
      <p className="admin-copy mb-4">Set the reward, then mark a pending referral qualified. Qualification credits the referrer wallet once, creates a ledger entry, and records an audit event. A paid referral cannot be reset or paid twice.</p>
      {data.referrals.map((x:any)=><Row key={x.id} title={x.status+' · '+naira(x.reward_minor)} meta={x.referrer_user_id+' → '+x.referred_user_id+' · '+date(x.created_at)}>
       {x.status==='PENDING'&&<>
        <input
          className="w-40 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={referralRewards[x.id] ?? String(x.reward_minor || '')}
          onChange={e=>setReferralRewards(v=>({...v,[x.id]:e.target.value}))}
          placeholder="Reward (minor)"
          aria-label="Referral reward in minor units"
        />
        <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>updateReferral(x.id,'QUALIFIED',Number(referralRewards[x.id] ?? x.reward_minor ?? 0),'Admin marked referral qualified and paid reward'),'Referral qualified and reward paid.')}>Mark qualified & pay</button>
       </>}
      </Row>) }
      {!data.referrals.length&&<Empty text="No referrals yet."/>}
    </Panel>}

    {tab==='lucky'&&<div className="grid gap-4 lg:grid-cols-[1fr_390px]">
      <Panel title="Lucky Wish draws"><p className="admin-copy mb-4">Only OPEN draws whose opening time has arrived and closing time has not passed appear in the user Lucky Wish area. Create multiple draws to show multiple live rewards at once.</p>{data.draws.map((x:any)=><Row key={x.id} title={x.status+' · '+x.title} meta={x.reward_type+' · '+naira(x.reward_minor||0)+' · '+date(x.closes_at)}>
       <button type="button" className="secondary-button" onClick={()=>setDraw({id:x.id,title:x.title,description:x.description||'',rewardType:x.reward_type,rewardMinor:Number(x.reward_minor||0),alternateReward:x.alternate_reward||'',entryCostMinor:Number(x.entry_cost_minor||0),opensAt:new Date(x.opens_at).toISOString().slice(0,16),closesAt:new Date(x.closes_at).toISOString().slice(0,16)})}>Edit</button>
       <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act(x.id,()=>toggleDraw(x.id,x.status!=='OPEN'),x.status==='OPEN'?'Draw closed.':'Draw opened.')}>{x.status==='OPEN'?'Close':'Open'}</button>
      </Row>)}{!data.draws.length&&<Empty text="No draws yet."/>}</Panel>
      <Panel title={draw.id?'Edit draw':'Create draw'}><div className="grid gap-2">
       <div><input className="account-form" placeholder="Title · e.g. Friday ₦500 Airtime Draw" value={draw.title} onChange={e=>setDraw({...draw,title:e.target.value})}/><p className="mt-1 text-xs opacity-50">Example: “Friday ₦500 Airtime Draw” — use a short name users will immediately understand.</p></div>
       <div><textarea className="account-form min-h-20" placeholder="Description · e.g. Join this free draw for a chance to win ₦500 airtime." value={draw.description} onChange={e=>setDraw({...draw,description:e.target.value})}/><p className="mt-1 text-xs opacity-50">Example: “Join this free draw for a chance to win ₦500 airtime. One entry per user.”</p></div>
       <select className="account-form" value={draw.rewardType} onChange={e=>setDraw({...draw,rewardType:e.target.value})}><option>CASH</option><option>ALTERNATE</option></select>
       <div><input className="account-form" type="number" min="0" step="1" placeholder="Cash reward ₦ · e.g. 500" value={draw.rewardMinor/100} onChange={e=>setDraw({...draw,rewardMinor:Math.round(Number(e.target.value)*100)})}/><p className="mt-1 text-xs opacity-50">For CASH: enter the wallet amount, e.g. 500 for ₦500.</p></div>
       <div><input className="account-form" placeholder="Alternative reward · e.g. ₦500 airtime" value={draw.alternateReward} onChange={e=>setDraw({...draw,alternateReward:e.target.value})}/><p className="mt-1 text-xs opacity-50">For ALTERNATE: describe exactly what the winner receives, e.g. “₦500 airtime”.</p></div>
       <div><input className="account-form" type="number" min="0" step="1" placeholder="Entry cost ₦ · 0 for free" value={draw.entryCostMinor/100} onChange={e=>setDraw({...draw,entryCostMinor:Math.round(Number(e.target.value)*100)})}/><p className="mt-1 text-xs opacity-50">Enter 0 for a free draw. Example: 0.</p></div>
       <label className="text-sm opacity-80">Opens<input className="account-form mt-1 w-full" type="datetime-local" value={draw.opensAt} onChange={e=>setDraw({...draw,opensAt:e.target.value})}/><span className="mt-1 block text-xs opacity-50">Example: today at 18:00. This uses your device time when creating the draw.</span></label>
       <label className="text-sm opacity-80">Closes<input className="account-form mt-1 w-full" type="datetime-local" value={draw.closesAt} onChange={e=>setDraw({...draw,closesAt:e.target.value})}/><span className="mt-1 block text-xs opacity-50">Example: today at 20:00. Closing must be after opening.</span></label>
       <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>{if(!draw.title.trim()||!draw.opensAt||!draw.closesAt)return setError('Title, opening time and closing time are required.');void act('draw',()=>draw.id?updateDraw(draw):createDraw(draw),draw.id?'Draw updated.':'Draw created.')}}><Save size={15}/>{draw.id?'Save draw':'Create draw'}</button>
       {draw.id&&<button type="button" className="secondary-button" onClick={()=>setDraw({...emptyDraw})}>New draw</button>}
      </div></Panel>
    </div>}

    {tab==='notifications'&&<Panel title="Send notifications"><div className="grid gap-2 max-w-xl">
      <select className="account-form" value={msg.userId} onChange={e=>setMsg({...msg,userId:e.target.value})}><option value="">All users</option>{data.profiles.map((u:any)=><option key={u.id} value={u.id}>{u.name||'Unnamed'} · {u.username||u.id}</option>)}</select><select className="account-form" value={msg.type} onChange={e=>setMsg({...msg,type:e.target.value})}><option value="SYSTEM">System update</option><option value="NEWS">News</option><option value="TRENDING">Trending</option><option value="IMPORTANT">Important</option><option value="NEW">New</option><option value="PROMOTION">Promotion</option></select>
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

    {tab==='settings'&&<div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Withdrawal policy"><div className="grid gap-3">
        <input className="account-form" value={policy.timezone} onChange={e=>setPolicy({...policy,timezone:e.target.value})} placeholder="Timezone (e.g. Africa/Lagos)"/>
        <div><div className="text-sm opacity-70 mb-2">Allowed withdrawal days</div><div className="flex flex-wrap gap-2">{days.map(d=><label key={d} className="admin-checkbox"><input type="checkbox" checked={policy.enabledDays.includes(d)} onChange={e=>setPolicy({...policy,enabledDays:e.target.checked?[...policy.enabledDays,d]:policy.enabledDays.filter((x:string)=>x!==d)})}/>{d}</label>)}</div></div>
        <div className="grid grid-cols-2 gap-2"><label className="text-sm opacity-80">Opens<input className="account-form mt-1 w-full" type="time" value={policy.startTime} onChange={e=>setPolicy({...policy,startTime:e.target.value})}/></label><label className="text-sm opacity-80">Closes<input className="account-form mt-1 w-full" type="time" value={policy.endTime} onChange={e=>setPolicy({...policy,endTime:e.target.value})}/></label></div>
        <input className="account-form" type="number" min="1000" step="1" value={policy.minimumMinor/100} onChange={e=>setPolicy({...policy,minimumMinor:Math.round(Number(e.target.value)*100)})} placeholder="Minimum withdrawal ₦"/>
        <input className="account-form" type="number" min="1000" step="1" value={policy.maximumMinor==null?'':policy.maximumMinor/100} onChange={e=>setPolicy({...policy,maximumMinor:e.target.value===''?null:Math.round(Number(e.target.value)*100)})} placeholder="Maximum withdrawal ₦ (optional)"/>
        <p className="text-xs opacity-60">Minimum can be set from ₦1,000 upward. Leave maximum blank for no maximum.</p>
        <label className="admin-checkbox"><input type="checkbox" checked={policy.enabled} onChange={e=>setPolicy({...policy,enabled:e.target.checked})}/> Withdrawals enabled</label>
        <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>{if(!policy.enabledDays.length)return setError('Select at least one withdrawal day.');if(policy.minimumMinor<100000)return setError('Minimum withdrawal cannot be lower than ₦1,000.');if(policy.maximumMinor!==null&&policy.maximumMinor<policy.minimumMinor)return setError('Maximum withdrawal must be at least minimum.');void act('withdrawal-policy',()=>savePolicy(policy),'Withdrawal policy saved.')}}><Save size={15}/>Save withdrawal policy</button>
      </div></Panel>
      <Panel title="Deposit policy"><div className="grid gap-3">
        <input className="account-form" value={depositPolicy.timezone} onChange={e=>setDepositPolicy({...depositPolicy,timezone:e.target.value})} placeholder="Timezone (e.g. Africa/Lagos)"/>
        <div><div className="text-sm opacity-70 mb-2">Allowed deposit days</div><div className="flex flex-wrap gap-2">{days.map(d=><label key={d} className="admin-checkbox"><input type="checkbox" checked={depositPolicy.enabledDays.includes(d)} onChange={e=>setDepositPolicy({...depositPolicy,enabledDays:e.target.checked?[...depositPolicy.enabledDays,d]:depositPolicy.enabledDays.filter((x:string)=>x!==d)})}/>{d}</label>)}</div></div>
        <div className="grid grid-cols-2 gap-2"><label className="text-sm opacity-80">Opens<input className="account-form mt-1 w-full" type="time" value={depositPolicy.startTime} onChange={e=>setDepositPolicy({...depositPolicy,startTime:e.target.value})}/></label><label className="text-sm opacity-80">Closes<input className="account-form mt-1 w-full" type="time" value={depositPolicy.endTime} onChange={e=>setDepositPolicy({...depositPolicy,endTime:e.target.value})}/></label></div>
        <p className="text-xs opacity-60">Deposits submitted outside this schedule are blocked by the server and database policy.</p>
        <label className="admin-checkbox"><input type="checkbox" checked={depositPolicy.enabled} onChange={e=>setDepositPolicy({...depositPolicy,enabled:e.target.checked})}/> Deposits enabled</label>
        <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>{if(!depositPolicy.enabledDays.length)return setError('Select at least one deposit day.');void act('deposit-policy',()=>saveDepositPolicy(depositPolicy),'Deposit policy saved.')}}><Save size={15}/>Save deposit policy</button>
      </div></Panel>
    </div>}
   </div>
   <button type="button" aria-label="Open marquee highlights" title="Marquee Highlights" className={adminScrolling?'marquee-fab is-scrolling':'marquee-fab'} onClick={()=>setMarqueeOpen(true)}><Bell size={21}/><span>Highlights</span></button>
   {marqueeOpen&&<div className="sheet-backdrop" onClick={()=>setMarqueeOpen(false)}><section className="sheet admin-marquee-sheet" onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><p className="eyebrow">Marquee Highlights</p><h2>Publish to users</h2></div><button className="icon-button" onClick={()=>setMarqueeOpen(false)}><Check size={17}/></button></div><div className="mb-4 space-y-2">{(data.marqueeItems||[]).map((item:any)=><div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"><div className="min-w-0 flex-1"><div className="truncate font-semibold">{item.title}</div><div className="truncate text-xs opacity-60">{item.content}</div></div><span className="text-[10px] opacity-50">{item.active?'LIVE':'OFF'}</span><button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>act('delete-marquee',()=>deleteMarquee(item.id),'MyQ post deleted.')}>Delete</button></div>)}{!(data.marqueeItems||[]).length&&<Empty text="No MyQ highlights yet."/>}</div><div className="grid gap-3"><select className="account-form" value={marquee.kind} onChange={e=>setMarquee({...marquee,kind:e.target.value})}><option value="HIGHLIGHT">Highlight</option><option value="TRENDING">Trending</option><option value="NEWS">News</option><option value="BROADCAST">Broadcast</option><option value="IMPORTANT">Important</option></select><input className="account-form" placeholder="Bold title" value={marquee.title} onChange={e=>setMarquee({...marquee,title:e.target.value})}/><textarea className="account-form min-h-28" placeholder="Marquee message" value={marquee.content} onChange={e=>setMarquee({...marquee,content:e.target.value})}/><select className="account-form" value={marquee.userId||''} onChange={e=>setMarquee({...marquee,userId:e.target.value||null})}><option value="">All users</option>{data.profiles.map((u:any)=><option key={u.id} value={u.id}>{u.name||'Unnamed'} · {u.username||u.id}</option>)}</select><label className="admin-checkbox"><input type="checkbox" checked={marquee.active} onChange={e=>setMarquee({...marquee,active:e.target.checked})}/> Publish now</label><button type="button" className="primary-button full" disabled={Boolean(busy)} onClick={()=>{if(!marquee.title.trim()||!marquee.content.trim())return setError('Marquee title and content are required.');void act('marquee',()=>saveMarquee(marquee),'Marquee published successfully.')}}><Send size={15}/>{busy==='marquee'?'Submitting…':'Publish marquee'}</button></div></section></div>}
      {manageOpen&&selectedUser&&<div className="sheet-backdrop" onClick={()=>setManageOpen(false)}><section className="sheet admin-manage-user-sheet" onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><p className="eyebrow">User management</p><h2>{selectedUser.name||'Unnamed'} · {selectedUser.username||'No username'}</h2><p className="sheet-copy">{selectedUser.email||'No email'} · {selectedUser.status}</p></div><button className="icon-button" onClick={()=>setManageOpen(false)}><Check size={17}/></button></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 p-4"><span className="text-xs opacity-60">Available</span><strong className="mt-1 block text-lg">{naira(selectedUser.available_balance_minor)}</strong></div><div className="rounded-2xl border border-white/10 p-4"><span className="text-xs opacity-60">Invested</span><strong className="mt-1 block text-lg">{naira(selectedUser.invested_balance_minor)}</strong></div><div className="rounded-2xl border border-white/10 p-4"><span className="text-xs opacity-60">Profit</span><strong className="mt-1 block text-lg">{naira(selectedUser.profit_balance_minor)}</strong></div></div><div className="mt-5"><h4 className="font-semibold">Balance adjustment</h4><div className="mt-3 grid gap-2 sm:grid-cols-3"><input className="account-form" placeholder="Amount ₦ (use - to debit)" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/><input className="account-form" placeholder="Reason (required)" value={reason} onChange={e=>setReason(e.target.value)}/><button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>{const n=Number(amount);if(!Number.isFinite(n)||n===0)return setError('Enter a non-zero amount.');if(!reason.trim())return setError('Enter a reason before saving.');void act('balance',()=>adjustUserBalance({userId:selectedUser.id,amountMinor:Math.round(n*100),reason:reason.trim()}),'Wallet adjustment saved.')}}><Save size={15}/>Apply adjustment</button></div></div><div className="mt-5 border-t border-white/10 pt-5"><h4 className="font-semibold">Profile</h4><div className="mt-3 grid gap-2 sm:grid-cols-2"><input className="account-form" placeholder="Full name" value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/><input className="account-form" placeholder="Username" value={profile.username} onChange={e=>setProfile({...profile,username:e.target.value})}/></div><button type="button" className="secondary-button mt-3" disabled={Boolean(busy)} onClick={()=>act('profile-users',()=>updateUserProfile({id:selectedUser.id,name:profile.name,username:profile.username}),'User profile saved.')}>Save profile changes</button></div><div className="mt-5 border-t border-white/10 pt-5"><h4 className="font-semibold mb-3">Recent activity</h4>{data.ledger.filter((x:any)=>x.user_id===selectedUser.id).slice(0,2).map((x:any)=><Row key={x.id} title={(x.type||'ACTIVITY').replaceAll('_',' ')+' · '+(x.direction==='CREDIT'?'+':'-')+naira(x.amount_minor)} meta={(x.status||'')+' · '+date(x.created_at)}/>)}{!data.ledger.some((x:any)=>x.user_id===selectedUser.id)&&<Empty text="No recent wallet activity."/>}</div></section></div>}
   {confirmPlan&&<div className="sheet-backdrop" onClick={()=>setConfirmPlan(null)}><section className="sheet" onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><p className="eyebrow">Confirm submission</p><h2>{confirmPlan.id?'Update investment plan':'Create investment plan'}</h2></div><button className="icon-button" onClick={()=>setConfirmPlan(null)}><Check size={17}/></button></div><div className="plan-calcs"><span><small>Plan</small><b>{confirmPlan.name}</b></span><span><small>Investment</small><b>{naira(confirmPlan.minimumMinor)}</b></span><span><small>Return earned</small><b>{naira(confirmPlan.returnMinor)}</b></span></div><p className="sheet-copy">Duration: <strong>{confirmPlan.durationDays} days</strong> · Purchase bonus: <strong>{naira(confirmPlan.purchaseBonusMinor)}</strong> · Total expected payout: <strong>{naira(confirmPlan.minimumMinor+confirmPlan.returnMinor+confirmPlan.purchaseBonusMinor)}</strong></p><div className="grid grid-cols-2 gap-2 mt-4"><button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>setConfirmPlan(null)}>Return to edit</button><button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>void act('plan',()=>savePlan(confirmPlan),confirmPlan.id?'Plan updated.':'Plan created.').then(()=>setConfirmPlan(null))}>{busy==='plan'?'Submitting…':'Proceed & submit'}</button></div></section></div>}
  </div>
 </main>
}

function Panel(p:any){return <section className="rounded-3xl border border-white/10 bg-white/5 p-5"><h2 className="mb-4 text-lg font-semibold">{p.title}</h2>{p.children}</section>}
function Row(p:any){return <article className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"><div className="min-w-0"><strong className="block break-words">{p.title}</strong><span className="text-xs opacity-60 break-all">{p.meta}</span></div><div className="flex flex-wrap gap-2">{p.children}</div></article>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm opacity-60">{text}</div>}
