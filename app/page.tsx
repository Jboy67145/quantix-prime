'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpRight,
  Bot,
  ChevronRight,
  CircleHelp,
  Copy,
  Gift,
  Home,
  LockKeyhole,
  MessageCircle,
  Moon,
  QrCode,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'lucky', label: 'Lucky Wish', icon: Gift },
  { id: 'invest', label: 'Invest', icon: TrendingUp },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'support', label: 'AI Support', icon: Bot },
  { id: 'my', label: 'My', icon: ShieldCheck },
] as const

type Tab = (typeof tabs)[number]['id']

type Plan = {
  name: string
  term: string
  rate: string
  min: string
  accent: string
}

const plans: Plan[] = [
  { name: 'Quantix Starter', term: '30 days', rate: '8.4%', min: '$100', accent: 'cyan' },
  { name: 'Quantix Momentum', term: '90 days', rate: '13.8%', min: '$500', accent: 'emerald' },
  { name: 'Quantix Horizon', term: '180 days', rate: '28.5%', min: '$1,000', accent: 'amber' },
]

const activity = [
  ['Investment matured', '+$62.40', 'Today, 09:42'],
  ['Referral reward', '+$12.00', 'Yesterday, 16:18'],
  ['Withdrawal', '-$80.00', 'Jun 18, 11:05'],
]

function AppIcon({ icon: Icon }: { icon: typeof Home }) {
  return <Icon aria-hidden="true" />
}

export default function Page() {
  const [active, setActive] = useState<Tab>('home')
  const [dark, setDark] = useState(true)
  const [toast, setToast] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [chat, setChat] = useState<string[]>(['Hi Maya, I’m Quantix AI. What can I help you with today?'])
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  const notify = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast(''), 2600)
  }

  const filteredActivity = useMemo(() => activity.filter((item) => item.join(' ').toLowerCase().includes(search.toLowerCase())), [search])

  const sendMessage = () => {
    if (!message.trim()) return
    setChat((current) => [...current, message.trim(), 'I can help with balances, plan terms, withdrawals, and account security. Try one of the topics below.'])
    setMessage('')
  }

  return (
    <main className={dark ? 'quantix-shell dark' : 'quantix-shell light'}>
      <div className="app-frame">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark"><Zap size={17} fill="currentColor" /></div>
            <div><strong>quantix</strong><span>PRIME</span></div>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="avatar" aria-label="Open profile" onClick={() => setActive('my')}>MC</button>
          </div>
        </header>

        <div className="screen-content">
          {active === 'home' && <HomeView notify={notify} onNavigate={setActive} activity={filteredActivity} search={search} setSearch={setSearch} />}
          {active === 'lucky' && <LuckyView notify={notify} />}
          {active === 'invest' && <InvestView onSelect={setSelectedPlan} />}
          {active === 'team' && <TeamView notify={notify} />}
          {active === 'support' && <SupportView chat={chat} message={message} setMessage={setMessage} sendMessage={sendMessage} />}
          {active === 'my' && <MyView notify={notify} onNavigate={setActive} />}
        </div>

        <nav className="bottom-nav" aria-label="Primary navigation">
          {tabs.map((tab) => <button key={tab.id} className={active === tab.id ? 'nav-item active' : 'nav-item'} onClick={() => setActive(tab.id)} aria-current={active === tab.id ? 'page' : undefined}><AppIcon icon={tab.icon} /><span>{tab.label}</span></button>)}
        </nav>
      </div>

      {selectedPlan && <PlanSheet plan={selectedPlan} onClose={() => setSelectedPlan(null)} notify={notify} />}
      {toast && <div className="toast" role="status"><Sparkles size={16} />{toast}</div>}
    </main>
  )
}

function PageHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>{action}</div>
}

function HomeView({ notify, onNavigate, activity, search, setSearch }: { notify: (text: string) => void; onNavigate: (tab: Tab) => void; activity: string[][]; search: string; setSearch: (value: string) => void }) {
  return <>
    <PageHeader eyebrow="Tuesday, June 24" title="Good morning, Maya" action={<button className="notification-dot" aria-label="Notifications" onClick={() => notify('You are all caught up')}><MessageCircle size={19} /></button>} />
    <section className="balance-card">
      <div className="balance-top"><span>Total balance <CircleHelp size={14} /></span><span className="live-pill"><i /> Live</span></div>
      <strong>$12,840.72</strong><div className="balance-meta"><span>+$482.16 this month</span><span>+3.9%</span></div>
      <div className="sparkline"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
    </section>
    <div className="quick-grid"><QuickAction icon={ArrowDownToLine} label="Deposit" onClick={() => notify('Demo deposit flow opened')} /><QuickAction icon={ArrowUpRight} label="Withdraw" onClick={() => notify('Demo withdrawal flow opened')} /><QuickAction icon={TrendingUp} label="Invest" onClick={() => onNavigate('invest')} /><QuickAction icon={Users} label="Invite" onClick={() => onNavigate('team')} /></div>
    <section className="section-block"><div className="section-heading"><h2>Community pulse</h2><span className="verified"><ShieldCheck size={14} /> Verified</span></div><div className="community-card"><div className="community-icon"><Users size={22} /></div><div><strong>1,248 members growing</strong><p>Your network is 12% more active this week.</p></div><ChevronRight size={18} /></div></section>
    <section className="section-block"><div className="section-heading"><h2>Recent activity</h2><button className="text-button" onClick={() => onNavigate('my')}>View all</button></div><div className="search-box"><Search size={16} /><input aria-label="Search activity" placeholder="Search activity" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="activity-list">{activity.map(([title, amount, date]) => <div className="activity-row" key={title}><div className="activity-icon"><Wallet size={17} /></div><div className="activity-copy"><strong>{title}</strong><span>{date}</span></div><b className={amount.startsWith('+') ? 'positive' : 'negative'}>{amount}</b></div>)}</div></section>
  </>
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Wallet; label: string; onClick: () => void }) { return <button className="quick-action" onClick={onClick}><span><Icon size={19} /></span>{label}</button> }

function LuckyView({ notify }: { notify: (text: string) => void }) {
  return <><PageHeader eyebrow="Community campaign" title="Lucky Wish" action={<button className="icon-button" onClick={() => notify('Lucky Wish rules opened')}><CircleHelp size={18} /></button>} /><section className="lucky-hero"><div className="lucky-orbit"><Gift size={30} /></div><p className="eyebrow">Next draw in</p><div className="countdown"><b>04</b><span>:</span><b>18</b><span>:</span><b>32</b></div><p>Hours &nbsp; Minutes &nbsp; Seconds</p></section><div className="metric-row"><Metric value="24/30" label="Entries" /><Metric value="$180" label="Your goal" /><Metric value="60%" label="Progress" /></div><section className="section-block"><div className="section-heading"><h2>How to qualify</h2><span className="muted">This week</span></div><div className="goal-list"><Goal done title="Complete your profile" detail="Verified and ready" /><Goal done title="Invite 3 community members" detail="3 of 3 completed" /><Goal title="Make an eligible investment" detail="$320 remaining" /></div><button className="primary-button full" onClick={() => notify('Your entry is saved for the next draw')}>Save my entry <ArrowUpRight size={16} /></button></section></>
}
function Metric({ value, label }: { value: string; label: string }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div> }
function Goal({ done, title, detail }: { done?: boolean; title: string; detail: string }) { return <div className="goal"><div className={done ? 'check done' : 'check'}>{done ? '✓' : ''}</div><div><strong>{title}</strong><span>{detail}</span></div><ChevronRight size={16} /></div> }

function InvestView({ onSelect }: { onSelect: (plan: Plan) => void }) { return <><PageHeader eyebrow="Build your balance" title="Invest" action={<button className="icon-button"><CircleHelp size={18} /></button>} /><div className="notice"><ShieldCheck size={18} /><p><strong>Clear terms, visible snapshots.</strong><br />Choose a fixed-return plan that fits your goal.</p></div><section className="section-block"><div className="section-heading"><h2>Available plans</h2><span className="muted">3 plans</span></div><div className="plan-list">{plans.map((plan) => <button className={`plan-card ${plan.accent}`} key={plan.name} onClick={() => onSelect(plan)}><div className="plan-line"><span className="plan-badge">{plan.term}</span><ChevronRight size={17} /></div><strong>{plan.name}</strong><div className="plan-stats"><span><b>{plan.rate}</b><small>Fixed return</small></span><span><b>{plan.min}</b><small>Minimum</small></span></div></button>)}</div></section><section className="section-block"><div className="section-heading"><h2>Your investments</h2><span className="positive">+$1,062.40</span></div><div className="investment-row"><div className="activity-icon emerald"><TrendingUp size={17} /></div><div className="activity-copy"><strong>Quantix Momentum</strong><span>Matures Sep 22, 2026</span></div><b>+$62.40</b></div></section></> }

function PlanSheet({ plan, onClose, notify }: { plan: Plan; onClose: () => void; notify: (text: string) => void }) { return <div className="sheet-backdrop" onClick={onClose}><section className="sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">Plan details</p><h2>{plan.name}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="detail-rate"><strong>{plan.rate}</strong><span>fixed return over {plan.term}</span></div><div className="formula"><span>Projected return</span><b>principal × {plan.rate}</b></div><div className="detail-points"><div><ShieldCheck size={17} /><span>Community eligibility required</span></div><div><LockKeyhole size={17} /><span>Snapshot locked after confirmation</span></div><div><Target size={17} /><span>Minimum starting balance: {plan.min}</span></div></div><button className="primary-button full" onClick={() => { notify(`${plan.name} added to your investment plan`); onClose() }}>Review investment <ArrowUpRight size={16} /></button></section></div> }

function TeamView({ notify }: { notify: (text: string) => void }) { return <><PageHeader eyebrow="Your community" title="Team" action={<button className="icon-button" onClick={() => notify('Referral QR opened')}><QrCode size={18} /></button>} /><section className="referral-card"><p className="eyebrow">Your invite code</p><div className="referral-code"><strong>MX7-QP24</strong><button onClick={() => notify('Invite code copied')} aria-label="Copy invite code"><Copy size={16} /></button></div><p>Share your code with people you know and grow together.</p><button className="primary-button" onClick={() => notify('Share sheet opened')}>Share invite <Send size={16} /></button></section><div className="metric-row"><Metric value="18" label="Members" /><Metric value="$216" label="Rewards" /><Metric value="92%" label="Active" /></div><section className="section-block"><div className="section-heading"><h2>Referral history</h2><span className="muted">This month</span></div><div className="referral-list"><div className="member-row"><div className="avatar small">AL</div><div className="activity-copy"><strong>Alex L.</strong><span>Joined Jun 21</span></div><b className="positive">+$12</b></div><div className="member-row"><div className="avatar small coral">JR</div><div className="activity-copy"><strong>Jordan R.</strong><span>Joined Jun 16</span></div><b className="positive">+$12</b></div><button className="secondary-button full" onClick={() => notify('All referrals loaded')}>View all referrals <ChevronRight size={16} /></button></div></section></> }

function SupportView({ chat, message, setMessage, sendMessage }: { chat: string[]; message: string; setMessage: (value: string) => void; sendMessage: () => void }) { return <><PageHeader eyebrow="Always here" title="AI Support" action={<span className="live-pill"><i /> Online</span>} /><div className="topic-grid"><button onClick={() => setMessage('How do I make a withdrawal?')}><Wallet size={17} />Withdrawals</button><button onClick={() => setMessage('Explain my investment return')}><TrendingUp size={17} />Investments</button><button onClick={() => setMessage('How is my account protected?')}><ShieldCheck size={17} />Security</button></div><div className="chat-card"><div className="chat-head"><div className="bot-avatar"><Bot size={19} /></div><div><strong>Quantix AI</strong><span>Replies instantly</span></div></div><div className="chat-messages">{chat.map((item, index) => <div key={`${item}-${index}`} className={index % 2 === 0 ? 'bubble user' : 'bubble bot'}>{item}</div>)}</div><div className="chat-composer"><input aria-label="Message Quantix AI" placeholder="Ask anything..." value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} /><button aria-label="Send message" onClick={sendMessage}><Send size={17} /></button></div></div><button className="escalate"><MessageCircle size={17} /> Need a human? Contact support</button></> }

function MyView({ notify, onNavigate }: { notify: (text: string) => void; onNavigate: (tab: Tab) => void }) { const rows = [{ icon: Wallet, label: 'Wallet & payment methods' }, { icon: ShieldCheck, label: 'Security & payment password' }, { icon: Settings, label: 'Settings' }, { icon: CircleHelp, label: 'FAQ & help' }]; return <><PageHeader eyebrow="Account center" title="My" action={<button className="icon-button" onClick={() => notify('Notifications opened')}><MessageCircle size={18} /></button>} /><section className="profile-card"><div className="profile-avatar">MC</div><div><strong>Maya Chen</strong><span>Prime member since 2024</span><div className="verified"><ShieldCheck size={13} /> Identity verified</div></div><ChevronRight size={18} /></section><section className="section-block"><div className="section-heading"><h2>Account overview</h2></div><div className="overview-grid"><Metric value="$12.8k" label="Balance" /><Metric value="4" label="Active plans" /><Metric value="18" label="Team members" /></div></section><section className="menu-list">{rows.map(({ icon: Icon, label }) => <button key={label} onClick={() => notify(`${label} opened`)}><span className="menu-icon"><Icon size={17} /></span><strong>{label}</strong><ChevronRight size={17} /></button>)}</section><button className="secondary-button full" onClick={() => { notify('Signed out of this demo'); onNavigate('home') }}>Log out of demo <ArrowUpRight size={16} /></button></> }
