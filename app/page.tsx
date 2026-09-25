'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, Copy, Gift, Home as HomeIcon, LogOut, Moon, ShieldCheck, Sun, TrendingUp, Users, Wallet, X, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-client'
import { getPublicPlans, purchaseInvestment, getUserInvestments } from '@/app/actions/investments'
import { getWalletSnapshot, getReferralSnapshot, getUserPayoutAccounts, addPayoutAccount, deletePayoutAccount } from '@/app/actions/wallet'
import { getOpenDraws, joinDraw, claimReward } from '@/app/actions/lucky'
import { getNotifications, markNotificationRead } from '@/app/actions/notifications'
import { WalletDashboard } from '@/components/wallet-dashboard'
import { AuthForm } from '@/components/auth-form'
import { useSession } from '@/lib/auth-client'

type Tab = 'home' | 'wallet' | 'lucky' | 'invest' | 'team' | 'me'
type Plan = { id: string; name: string; description: string; category: string; minimumMinor: number; maximumMinor: number; returnBps: number; durationDays: number; dailyEarningsMinor: number; totalEarningsMinor: number; purchaseBonusMinor: number; status: string }
type Draw = { draw: { id: string; title: string; description: string; rewardType: string; rewardMinor?: number | null; alternateReward?: string | null; closesAt: string | Date }; entryId: string | null }
type Notice = { id: string; title: string; body: string; readAt: string | Date | null }
const money = (minor: number) => `₦${Math.round(minor / 100).toLocaleString('en-NG')}`

export default function Page() {
  const router = useRouter()
  const { data: session, isPending: authPending } = useSession()
  const [tab, setTab] = useState<Tab>('home')
  const [dark, setDark] = useState(true)
  const [plans, setPlans] = useState<Plan[]>([])
  const [investments, setInvestments] = useState<any[]>([])
  const [wallet, setWallet] = useState<any>(null)
  const [referral, setReferral] = useState<any>(null)
  const [draws, setDraws] = useState<Draw[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [selected, setSelected] = useState<Plan | null>(null)
  const [toast, setToast] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const notify = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => {
    if (authPending || !session?.user) return

    const requested = new URLSearchParams(window.location.search).get('tab')
    if (['home', 'wallet', 'lucky', 'invest', 'team', 'me'].includes(requested || '')) {
      setTab(requested as Tab)
    }

    const refreshAccount = () => {
      getUserInvestments().then(setInvestments).catch(() => {})
      getWalletSnapshot().then((v) => setWallet(v)).catch(() => {})
    }

    getPublicPlans().then((v) => setPlans(v as Plan[])).catch(() => {})
    refreshAccount()
    getReferralSnapshot().then(setReferral).catch(() => {})
    getOpenDraws().then((v) => setDraws(v as Draw[])).catch(() => {})
    getNotifications().then((v) => setNotices(v as Notice[])).catch(() => {})

    window.addEventListener('quantix:refresh', refreshAccount)
    return () => window.removeEventListener('quantix:refresh', refreshAccount)
  }, [authPending, session?.user?.id])

  if (authPending) {
    return <main className="quantix-shell dark"><div className="app-frame"><div className="admin-loading">Checking your secure session…</div></div></main>
  }

  if (!session?.user) {
    return <main className="quantix-shell dark"><div className="app-frame"><header className="topbar"><div className="brand-lockup"><div className="brand-mark"><Zap size={17} /></div><div><strong>quantix</strong><span>PRIME</span></div></div></header><div className="screen-content"><Header eyebrow="Welcome" title="Create your Quantix account" /><p className="sheet-copy">New to Quantix Prime? Create your account below. If you already have an account, use Sign in.</p><AuthForm mode="sign-up" /><p className="auth-switch">Already have an account? <a href="/sign-in">Sign in securely</a></p></div></div></main>
  }

  async function logout() {
    try { await signOut() } finally { router.replace('/sign-in'); router.refresh() }
  }

  return <main className={dark ? 'quantix-shell dark' : 'quantix-shell light'}><div className="app-frame"><header className="topbar"><div className="brand-lockup"><div className="brand-mark"><Zap size={17} /></div><div><strong>quantix</strong><span>PRIME</span></div></div><div className="top-actions"><button className="icon-button notification-dot" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={18} />{notices.some((n) => !n.readAt) && <i />}</button><button className="icon-button" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></div></header>{notificationsOpen && <NotificationPanel notices={notices} close={() => setNotificationsOpen(false)} />}{tab === 'home' && <Home setTab={setTab} notices={notices} wallet={wallet} profile={referral?.profile} />}{tab === 'wallet' && <WalletDashboard notify={notify} />}{tab === 'lucky' && <Lucky draws={draws} refresh={() => getOpenDraws().then((v) => setDraws(v as Draw[]))} notify={notify} />}{tab === 'invest' && <Invest plans={plans} investments={investments} open={(p) => setSelected(p)} />}{tab === 'team' && <Team notify={notify} referral={referral} />}{tab === 'me' && <Me logout={logout} />}{selected && <InvestmentSheet plan={selected} close={() => setSelected(null)} notify={notify} />}{toast && <div className="toast" role="status">{toast}</div>}<nav className="bottom-nav" aria-label="Primary navigation"><Nav active={tab} id="home" label="Home" icon={HomeIcon} set={setTab} /><Nav active={tab} id="wallet" label="Wallet" icon={Wallet} set={setTab} /><Nav active={tab} id="lucky" label="Lucky Wish" icon={Gift} set={setTab} /><Nav active={tab} id="invest" label="Invest" icon={TrendingUp} set={setTab} /><Nav active={tab} id="team" label="Team" icon={Users} set={setTab} /><Nav active={tab} id="me" label="Me" icon={ShieldCheck} set={setTab} /></nav></div></main>
}

function Nav({ active, id, label, icon: Icon, set }: any) { return <button className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => set(id)}><Icon /><span>{label}</span></button> }
function Header({ eyebrow, title }: { eyebrow: string; title: string }) { return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div></div> }
function Home({ setTab, notices, wallet, profile }: any) { const hour = Number(new Intl.DateTimeFormat('en-NG', { hour: 'numeric', hour12: false, timeZone: 'Africa/Lagos' }).format(new Date())); const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; const name = profile?.username || 'Investor'; return <div className="screen-content"><Header eyebrow="Your portfolio" title={`${greeting}, ${name}`} /><section className="balance-card"><div className="balance-top"><span>Total wallet balance</span><span className="live-pill"><i /> Live</span></div><strong>₦{((wallet?.wallet?.available_minor || 0) / 100).toLocaleString('en-NG')}</strong><div className="balance-meta"><span>{wallet?.trendPercent >= 0 ? '+' : ''}{wallet?.trendPercent || 0}% net activity</span><span>{wallet?.active?.length || 0} active positions</span></div></section><div className="quick-grid"><button className="quick-action" onClick={() => setTab('invest')}><span><TrendingUp size={19} /></span>Invest</button><button className="quick-action" onClick={() => setTab('lucky')}><span><Gift size={19} /></span>Lucky Wish</button><button className="quick-action" onClick={() => setTab('team')}><span><Users size={19} /></span>Invite</button><button className="quick-action" onClick={() => setTab('wallet')}><span><Wallet size={19} /></span>Wallet</button></div><section className="section-block"><div className="section-heading"><h2>Recent activity</h2><span className="muted">{notices.length} updates</span></div><div className="activity-list">{wallet?.ledger?.length ? wallet.ledger.map((entry: any) => <div className="activity-row" key={entry.id}><div className={entry.direction === 'CREDIT' ? 'activity-icon emerald' : 'activity-icon amber'}><Wallet size={17} /></div><div className="activity-copy"><strong>{entry.type.replaceAll('_', ' ')}</strong><span>{entry.direction === 'CREDIT' ? '+' : '-'}{money(entry.amount_minor)} · {new Date(entry.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</span></div><b className={entry.direction === 'CREDIT' ? 'status-success' : 'status-pending'}>{entry.status}</b></div>) : <div className="activity-row"><div className="activity-icon emerald"><ShieldCheck size={17} /></div><div className="activity-copy"><strong>Your account is ready</strong><span>Choose an investment plan or enter Lucky Wish.</span></div></div>}</div></section></div> }
function Lucky({ draws, refresh, notify }: { draws: Draw[]; refresh: () => void; notify: (s: string) => void }) { return <div className="screen-content"><Header eyebrow="Rewards" title="Lucky Wish" /><section className="lucky-hero"><div className="lucky-orbit"><Gift size={27} /></div><p className="eyebrow">Win real rewards</p><h2>One entry. One winner.</h2><p>Join open draws before they close. Winners are selected automatically at the configured end time.</p></section><section className="section-block"><div className="section-heading"><h2>Open draws</h2><span className="muted">{draws.length} live</span></div>{draws.length === 0 ? <div className="empty-state"><Gift size={24} /><h2>No open draws</h2><p>Check back when the next reward draw opens.</p></div> : <div className="plan-list">{draws.map(({ draw, entryId }) => <article className="plan-card amber" key={draw.id}><div className="plan-line"><span className="plan-badge">{draw.rewardType === 'CASH' ? money(draw.rewardMinor || 0) : draw.alternateReward}</span><span className="muted">Closes {new Date(draw.closesAt).toLocaleDateString()}</span></div><strong>{draw.title}</strong><p className="plan-description">{draw.description}</p>{entryId ? <button className="secondary-button full" onClick={() => notify('You are already entered')}>Entry confirmed <Check size={16} /></button> : <button className="primary-button full" onClick={async () => { try { await joinDraw(draw.id); notify('You are entered in the draw'); refresh() } catch (e) { notify(e instanceof Error ? e.message : 'Unable to join draw') } }}>Join draw <Gift size={16} /></button>}</article>)}</div>}</section></div> }
function Invest({ plans, investments, open }: { plans: Plan[]; investments: any[]; open: (p: Plan) => void }) { const [category, setCategory] = useState('DAILY'); const [filter, setFilter] = useState<'AVAILABLE' | 'INVESTED'>('AVAILABLE'); const visible = plans.filter((p) => p.category === category); const activeInvestments = investments.filter((item) => item.status === 'ACTIVE'); return <div className="screen-content"><Header eyebrow="Grow your balance" title="Invest" /><div className="filter-tabs"><button className={filter === 'INVESTED' ? 'active' : ''} onClick={() => setFilter('INVESTED')}>Invested Plans</button><button className={filter === 'AVAILABLE' ? 'active' : ''} onClick={() => setFilter('AVAILABLE')}>Available Plans</button></div>{filter === 'INVESTED' ? <section className="section-block"><div className="section-heading"><h2>Your running investments</h2><span className="muted">{activeInvestments.length} running</span></div>{activeInvestments.length === 0 ? <div className="empty-state"><TrendingUp size={24} /><h2>No running investments</h2><p>Once you confirm an investment, it will appear here as its own running position.</p></div> : <div className="plan-list">{activeInvestments.map((item) => <article className="plan-card emerald" key={item.id}><div className="plan-line"><span className="plan-badge">Running</span><b>{money(Number(item.profit_minor || 0))} profit</b></div><strong>{item.plan_name_snapshot}</strong><p className="plan-description">{money(Number(item.principal_minor || 0))} invested separately on {new Date(item.started_at).toLocaleString('en-NG')}</p><div className="plan-calcs"><span><small>Principal</small><b>{money(Number(item.principal_minor || 0))}</b></span><span><small>Maturity</small><b>{money(Number(item.maturity_minor || 0))}</b></span><span><small>Matures</small><b>{new Date(item.matures_at).toLocaleString('en-NG')}</b></span></div><p className="plan-range">Each investment is calculated and matured independently.</p></article>)}</div>}</section> : <><div className="category-tabs">{['DAILY', 'WEEKLY', 'MONTHLY'].map((c) => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c[0] + c.slice(1).toLowerCase()}</button>)}</div><section className="section-block"><div className="section-heading"><h2>{category[0] + category.slice(1).toLowerCase()} plans</h2><span className="muted">{visible.length} available</span></div>{visible.length === 0 ? <div className="empty-state"><TrendingUp size={24} /><h2>No plans configured</h2><p>Investment plans will appear here when operations publishes them.</p></div> : <div className="plan-list">{visible.map((p) => <PlanCard key={p.id} plan={p} open={open} />)}</div>}</section></>}</div> }
function PlanCard({ plan, open }: { plan: Plan; open: (p: Plan) => void }) { return <article className="plan-card emerald"><div className="plan-line"><span className="plan-badge">{plan.durationDays} days</span><b>{money(plan.dailyEarningsMinor)} daily</b></div><strong>{plan.name}</strong><p className="plan-description">{plan.description}</p><div className="plan-calcs"><span><small>Investment</small><b>{money(plan.minimumMinor)}</b></span><span><small>Profit</small><b>{money(plan.totalEarningsMinor - plan.minimumMinor)}</b></span><span><small>Maturity</small><b>{money(plan.totalEarningsMinor)}</b></span></div><button className="primary-button full" onClick={() => open(plan)}>Invest from wallet <TrendingUp size={16} /></button><p className="plan-range">{plan.durationDays} calendar days · Bonus {money(plan.purchaseBonusMinor)}</p></article> }
function Team({ notify, referral }: any) { const copy = async () => { const link = referral?.link || `${location.origin}/sign-up?ref=${referral?.profile?.username || ''}`; await navigator.clipboard?.writeText(link); notify('Referral link copied'); }; return <div className="screen-content"><Header eyebrow="Community" title="Team" /><section className="mini-wallet"><div><span>Total earned</span><strong>{money(referral?.earned || 0)}</strong></div><div><span>Pending earnings</span><strong>{money(referral?.pending || 0)}</strong></div></section><section className="referral-card"><p className="eyebrow">Your invite link</p><div className="referral-code"><strong>{referral?.profile?.username || 'Loading'}</strong><button onClick={copy}><Copy size={16} /></button></div><p>Your referral bonus unlocks after an invitee completes their first approved deposit.</p><button className="primary-button" onClick={copy}>Copy invite link <Copy size={16} /></button></section><section className="section-block"><div className="section-heading"><h2>Invitees</h2><span className="muted">{referral?.referrals?.length || 0} registered</span></div>{referral?.referrals?.map((item: any) => <div className="activity-row" key={item.id}><div className="activity-icon emerald"><Users size={17} /></div><div className="activity-copy"><strong>{item.status === 'QUALIFIED' ? 'Reward qualified' : 'Pending first deposit'}</strong><span>{item.status === 'QUALIFIED' ? money(item.rewardMinor) + ' earned' : 'No bonus yet'}</span></div></div>)}</section></div> }
function Me({ logout }: any) {
  const [accounts, setAccounts] = useState<any[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ bankName: '', accountName: '', accountNumber: '' })
  useEffect(() => { getUserPayoutAccounts().then(setAccounts).catch(() => {}) }, [])
  const saveAccount = async () => {
    try {
      const account = await addPayoutAccount(form)
      setAccounts((current) => [...current, account])
      setForm({ bankName: '', accountName: '', accountNumber: '' })
      setAdding(false)
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Unable to save payout account.') }
  }
  const removeAccount = async (id: string) => {
    if (!window.confirm('Remove this payout account? It will no longer be available for withdrawals.')) return
    try {
      await deletePayoutAccount(id)
      setAccounts((current) => current.filter((account) => account.id !== id))
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Unable to remove payout account.') }
  }
  const enablePush = async () => { if (!('Notification' in window)) return; const permission = await Notification.requestPermission(); if (permission === 'granted' && 'serviceWorker' in navigator) await navigator.serviceWorker.register('/sw.js') }
  return <div className="screen-content"><Header eyebrow="Account center" title="Me" /><section className="profile-card"><div className="profile-avatar">Q</div><div><strong>Your Quantix account</strong><span>Securely manage your profile and support</span><div className="verified"><ShieldCheck size={13} /> Protected account</div></div></section><section className="section-block"><div className="section-heading"><h2>Withdrawal accounts</h2><span className="muted">{accounts.length}/2 saved</span></div>{accounts.map((account) => <div className="account-tile" key={account.id}><Wallet size={17} /><span><strong>{account.bankName}</strong><small>{account.accountName} · {account.accountNumber}</small></span><button className="icon-button" aria-label="Remove payout account" title="Remove account" onClick={() => removeAccount(account.id)}><X size={16} /></button></div>)}{accounts.length < 2 && (adding ? <div className="account-form"><input placeholder="Bank name" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /><input placeholder="Account name" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} /><input placeholder="10-digit account number" inputMode="numeric" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /><button className="primary-button full" onClick={saveAccount}>Save account</button></div> : <button className="secondary-button full" onClick={() => setAdding(true)}>Add Account</button>)}</section><div className="menu-list"><button><span className="menu-icon"><Wallet size={17} /></span><strong>Wallet & payment methods</strong></button><button><span className="menu-icon"><Users size={17} /></span><strong>Support center</strong></button><button onClick={enablePush}><span className="menu-icon"><Bell size={17} /></span><strong>Enable browser notifications</strong></button></div><button className="secondary-button full" onClick={logout}><LogOut size={16} /> Log out securely</button></div>
}
function NotificationPanel({ notices, close }: { notices: Notice[]; close: () => void }) { return <div className="notification-panel"><div className="sheet-title"><div><p className="eyebrow">Updates</p><h2>Notifications</h2></div><button className="icon-button" onClick={close}><X size={17} /></button></div>{notices.length === 0 ? <p className="muted">No notifications yet.</p> : notices.map((n) => <button className={n.readAt ? 'notice-row read' : 'notice-row'} key={n.id} onClick={() => markNotificationRead(n.id)}><Bell size={15} /><span><b>{n.title}</b><small>{n.body}</small></span></button>)}</div> }
function InvestmentSheet({ plan, close, notify }: { plan: Plan; close: () => void; notify: (s: string) => void }) { const [busy, setBusy] = useState(false); return <div className="sheet-backdrop" onClick={close}><section className="sheet" onClick={(e) => e.stopPropagation()}><div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">Confirm {plan.name}</p><h2>Wallet investment</h2></div><button className="icon-button" onClick={close}><X size={18} /></button></div><p className="sheet-copy">{money(plan.minimumMinor)} will be deducted from your available balance. Your {money(plan.purchaseBonusMinor)} instant bonus is credited separately.</p><div className="plan-calcs"><span><small>Principal</small><b>{money(plan.minimumMinor)}</b></span><span><small>Profit</small><b>{money(plan.totalEarningsMinor - plan.minimumMinor)}</b></span><span><small>Maturity</small><b>{money(plan.totalEarningsMinor)}</b></span></div><button className="primary-button full" disabled={busy} onClick={async () => { setBusy(true); try { await purchaseInvestment({ planId: plan.id }); notify('Investment purchased successfully. Your balance has been updated.'); close(); window.dispatchEvent(new CustomEvent('quantix:refresh')) } catch (e) { notify(e instanceof Error ? e.message : 'Unable to purchase investment') } finally { setBusy(false) } }}>{busy ? 'Processing...' : 'Confirm investment'} <Check size={16} /></button></section></div> }
