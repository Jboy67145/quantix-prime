'use client'

import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Clock3, Landmark, Plus, RefreshCw, WalletCards } from 'lucide-react'
import { getWalletDetails, getUserPayoutAccounts, addPayoutAccount, requestWithdrawal } from '@/app/actions/wallet'

const money = (minor: number) => `₦${Math.round(Number(minor || 0) / 100).toLocaleString('en-NG')}`
type WalletData = { wallet: any; deposits: any[]; withdrawals: any[]; accounts: any[] }

export function WalletDashboard({ notify }: { notify: (message: string) => void }) {
  const [data, setData] = useState<WalletData>({ wallet: null, deposits: [], withdrawals: [], accounts: [] })
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'deposit' | 'withdraw' | 'account' | null>(null)
  const [form, setForm] = useState({ amount: '', payoutAccountId: '', bankName: '', accountName: '', accountNumber: '' })
  const refresh = () => getWalletDetails().then(setData).catch(() => notify('Unable to load wallet'))
  useEffect(() => { refresh() }, [])
  const submit = async () => {
    setBusy(true)
    try {
      if (mode === 'account') await addPayoutAccount({ bankName: form.bankName, accountName: form.accountName, accountNumber: form.accountNumber })
      if (mode === 'withdraw') await requestWithdrawal({ payoutAccountId: form.payoutAccountId, amountMinor: Math.round(Number(form.amount) * 100) })
      notify(mode === 'withdraw' ? 'Withdrawal request submitted' : mode === 'account' ? 'Payout account saved' : 'Wallet updated')
      setMode(null); setForm({ amount: '', payoutAccountId: '', bankName: '', accountName: '', accountNumber: '' }); refresh()
    } catch (error) { notify(error instanceof Error ? error.message : 'Unable to complete request') } finally { setBusy(false) }
  }
  const available = Number(data.wallet?.available_minor || 0)
  const invested = Number(data.wallet?.invested_minor || 0)
  return <div className="screen-content">
    <div className="page-header"><div><p className="eyebrow">Money center</p><h1>Wallet</h1></div><button className="icon-button" aria-label="Refresh wallet" onClick={refresh}><RefreshCw size={17} /></button></div>
    <section className="balance-card wallet-balance"><div className="balance-top"><span>Available balance</span><span className="live-pill"><i /> Live</span></div><strong>{money(available)}</strong><div className="balance-meta"><span>Invested {money(invested)}</span><span>Profit {money(data.wallet?.profit_minor || 0)}</span></div></section>
    <div className="wallet-actions"><button onClick={() => setMode('deposit')}><span><ArrowDownToLine size={18} /></span>Deposit</button><button onClick={() => setMode('withdraw')}><span><ArrowUpFromLine size={18} /></span>Withdraw</button><button onClick={() => setMode('account')}><span><Landmark size={18} /></span>Payout account</button></div>
    <section className="section-block"><div className="section-heading"><h2>Payout accounts</h2><span className="muted">{data.accounts.length}/2 saved</span></div>{data.accounts.length ? data.accounts.map((account) => <div className="account-tile" key={account.id}><Landmark size={17} /><span><strong>{account.bank_name}</strong><small>{account.account_name} · {account.account_number}</small></span>{account.is_default && <b className="status-success">Default</b>}</div>) : <div className="empty-state"><WalletCards size={24} /><h2>No payout account</h2><p>Add an account before requesting a withdrawal.</p></div>}</section>
    <section className="section-block"><div className="section-heading"><h2>Wallet activity</h2><span className="muted">Recent</span></div><div className="activity-list">{[...data.deposits.map((item) => ({ ...item, kind: 'Deposit', amount: item.amount_minor })), ...data.withdrawals.map((item) => ({ ...item, kind: 'Withdrawal', amount: item.amount_minor }))].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 8).map((item) => <div className="activity-row" key={`${item.kind}-${item.id}`}><div className="activity-icon emerald">{item.kind === 'Deposit' ? <ArrowDownToLine size={17} /> : <ArrowUpFromLine size={17} />}</div><div className="activity-copy"><strong>{item.kind}</strong><span>{new Date(item.created_at).toLocaleDateString('en-NG')}</span></div><b className={item.kind === 'Deposit' ? 'positive' : 'negative'}>{item.kind === 'Deposit' ? '+' : '-'}{money(item.amount)}</b><small className={item.status === 'APPROVED' ? 'status-success' : 'status-pending'}>{item.status}</small></div>)}{!data.deposits.length && !data.withdrawals.length && <div className="empty-state"><Clock3 size={22} /><p>No wallet activity yet.</p></div>}</div></section>
    {mode && <div className="sheet-backdrop" onClick={() => setMode(null)}><section className="sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">Wallet action</p><h2>{mode === 'withdraw' ? 'Withdraw funds' : mode === 'account' ? 'Add payout account' : 'Deposit funds'}</h2></div><button className="icon-button" onClick={() => setMode(null)}>×</button></div>{mode === 'deposit' ? <p className="sheet-copy">Choose an investment plan to submit a deposit with payment proof. Your available balance updates after admin approval.</p> : mode === 'withdraw' ? <><label>Amount<input type="number" min="0" placeholder="Amount in naira" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label>Payout account<select value={form.payoutAccountId} onChange={(event) => setForm({ ...form, payoutAccountId: event.target.value })}><option value="">Select account</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.bank_name} · {account.account_number}</option>)}</select></label></> : <><label>Bank name<input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} /></label><label>Account name<input value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} /></label><label>Account number<input inputMode="numeric" value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} /></label></>} {mode === 'deposit' ? <button className="primary-button full" onClick={() => notify('Open Invest to submit a deposit proof')}>Open Invest <Plus size={16} /></button> : <button className="primary-button full" disabled={busy} onClick={submit}>{busy ? 'Saving...' : mode === 'withdraw' ? 'Request withdrawal' : 'Save account'}</button>}</section></div>}
  </div>
}
