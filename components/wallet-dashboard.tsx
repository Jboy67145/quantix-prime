'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Clock3, Landmark, RefreshCw, WalletCards } from 'lucide-react'
import { getWalletDetails, getUserPayoutAccounts, addPayoutAccount, requestWithdrawal, uploadDepositProof, submitWalletDeposit } from '@/app/actions/wallet'
import { getPaymentAccounts } from '@/app/actions/investments'

const money = (minor: number) => `₦${(Number(minor || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
type WalletData = { wallet: any; deposits: any[]; withdrawals: any[]; accounts: any[] }
type Mode = 'deposit' | 'withdraw' | 'account' | null

export function WalletDashboard({ notify }: { notify: (message: string) => void }) {
  const [data, setData] = useState<WalletData>({ wallet: null, deposits: [], withdrawals: [], accounts: [] })
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [fundingAccounts, setFundingAccounts] = useState<any[]>([])
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [withdrawalError, setWithdrawalError] = useState('')
  const [depositError, setDepositError] = useState('')
  const [form, setForm] = useState({ amount: '', payoutAccountId: '', paymentAccountId: '', senderName: '', transferReference: '', bankName: '', accountName: '', accountNumber: '' })
  const refresh = () => getWalletDetails().then(setData).catch(() => notify('Unable to load wallet'))
  useEffect(() => { refresh(); getPaymentAccounts().then(setFundingAccounts).catch(() => setDepositError('We could not load deposit accounts. Please try again.')) }, [])
  const available = Number(data.wallet?.available_minor || 0)
  const invested = Number(data.wallet?.invested_minor || 0)
  const pending = data.withdrawals.filter((item) => ['PENDING', 'PROCESSING'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount_minor || 0), 0)
  const withdrawable = Math.max(0, available - pending)
  const amountMinor = Math.round(Number(form.amount || 0) * 100)
  const withdrawalMessage = useMemo(() => {
    if (mode !== 'withdraw') return ''
    if (!form.amount) return ''
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) return 'Withdrawal amount must be greater than ₦0.'
    if (amountMinor > withdrawable) return withdrawable === 0 ? 'Insufficient funds. Your available balance is ₦0.00.' : `Insufficient funds. You can withdraw up to ${money(withdrawable)}.`
    return ''
  }, [amountMinor, form.amount, mode, withdrawable])
  const openMode = (next: Mode) => { setMode(next); setWithdrawalError(''); setDepositError(''); setProofFile(null); setForm({ amount: '', payoutAccountId: '', paymentAccountId: '', senderName: '', transferReference: '', bankName: '', accountName: '', accountNumber: '' }) }
  const closeMode = () => { setMode(null); setWithdrawalError(''); setDepositError(''); setProofFile(null) }
  const submit = async () => {
    if (mode === 'withdraw' && withdrawalMessage) { setWithdrawalError(withdrawalMessage); return }
    setBusy(true)
    try {
      if (mode === 'account') await addPayoutAccount({ bankName: form.bankName, accountName: form.accountName, accountNumber: form.accountNumber })
      if (mode === 'withdraw') {
        if (!form.payoutAccountId) throw new Error('Please add and select a payout account before withdrawing.')
        await requestWithdrawal({ payoutAccountId: form.payoutAccountId, amountMinor })
      }
      if (mode === 'deposit') {
        const depositAmount = Math.round(Number(form.amount || 0) * 100)
        if (!Number.isFinite(depositAmount) || depositAmount <= 0) throw new Error('Enter a valid deposit amount.')
        if (!form.paymentAccountId) throw new Error('Please select a deposit method.')
        if (!proofFile) throw new Error('Please upload your payment proof.')
        const proofPathname = await uploadDepositProof(proofFile)
        await submitWalletDeposit({ amountMinor: depositAmount, paymentAccountId: form.paymentAccountId, senderName: form.senderName, transferReference: form.transferReference, proofPathname })
      }
      notify(mode === 'withdraw' ? 'Withdrawal request submitted' : mode === 'deposit' ? 'Deposit request submitted for review' : 'Payout account saved')
      closeMode(); refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not complete this request. Please try again.'
      if (mode === 'withdraw') setWithdrawalError(message); else if (mode === 'deposit') setDepositError(message); else notify(message)
    } finally { setBusy(false) }
  }
  const activities = [...data.deposits.map((item) => ({ ...item, kind: 'Deposit', amount: item.amount_minor })), ...data.withdrawals.map((item) => ({ ...item, kind: 'Withdrawal', amount: item.amount_minor }))].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 8)
  return <div className="screen-content">
    <div className="page-header"><div><p className="eyebrow">Money center</p><h1>Wallet</h1></div><button className="icon-button" aria-label="Refresh wallet" onClick={refresh}><RefreshCw size={17} /></button></div>
    <section className="balance-card wallet-balance"><div className="balance-top"><span>Total balance</span><span className="live-pill"><i /> Live</span></div><strong>{money(available + invested)}</strong><div className="balance-meta"><span>Available {money(available)}</span><span>Invested {money(invested)}</span></div></section>
    <section className="balance-breakdown"><div><small>Withdrawable</small><strong>{money(withdrawable)}</strong></div><div><small>Pending / locked</small><strong>{money(pending)}</strong></div><div><small>Expected profit</small><strong>{money(data.wallet?.profit_minor || 0)}</strong></div></section>
    <div className="wallet-actions"><button onClick={() => openMode('deposit')}><span><ArrowDownToLine size={18} /></span>Deposit</button><button onClick={() => openMode('withdraw')}><span><ArrowUpFromLine size={18} /></span>Withdraw</button><button onClick={() => openMode('account')}><span><Landmark size={18} /></span>Payout account</button></div>
    <section className="section-block"><div className="section-heading"><h2>Payout accounts</h2><span className="muted">{data.accounts.length}/2 saved</span></div>{data.accounts.length ? data.accounts.map((account) => <div className="account-tile" key={account.id}><Landmark size={17} /><span><strong>{account.bank_name}</strong><small>{account.account_name} · {account.account_number}</small></span>{account.is_default && <b className="status-success">Default</b>}</div>) : <div className="empty-state"><WalletCards size={24} /><h2>No payout account</h2><p>Add an account before requesting a withdrawal.</p></div>}</section>
    <section className="section-block"><div className="section-heading"><h2>Wallet activity</h2><span className="muted">Recent</span></div><div className="activity-list">{activities.map((item) => <div className="activity-row" key={`${item.kind}-${item.id}`}><div className="activity-icon emerald">{item.kind === 'Deposit' ? <ArrowDownToLine size={17} /> : <ArrowUpFromLine size={17} />}</div><div className="activity-copy"><strong>{item.kind}</strong><span>{new Date(item.created_at).toLocaleDateString('en-NG')}</span></div><b className={item.kind === 'Deposit' ? 'positive' : 'negative'}>{item.kind === 'Deposit' ? '+' : '-'}{money(item.amount)}</b><small className={item.status === 'APPROVED' ? 'status-success' : 'status-pending'}>{item.status}</small></div>)}{!activities.length && <div className="empty-state"><Clock3 size={22} /><p>No wallet activity yet.</p></div>}</div></section>
    {mode && <div className="sheet-backdrop" onClick={closeMode}><section className="sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">Wallet action</p><h2>{mode === 'withdraw' ? 'Withdraw funds' : mode === 'account' ? 'Add payout account' : 'Deposit funds'}</h2></div><button className="icon-button" onClick={closeMode}>×</button></div>
      {mode === 'deposit' && <><p className="sheet-copy">Deposit funds into your wallet. Your current balance does not affect deposit eligibility.</p><label>Deposit amount<input type="number" min="1" step="0.01" placeholder="Amount in naira" value={form.amount} onChange={(event) => { setDepositError(''); setForm({ ...form, amount: event.target.value }) }} /></label>{form.amount && <div className="funding-account-list"><p className="eyebrow">Choose a payment account</p>{fundingAccounts.map((account) => <button type="button" className={form.paymentAccountId === account.id ? 'funding-account selected' : 'funding-account'} key={account.id} onClick={() => setForm({ ...form, paymentAccountId: account.id })}><strong>{account.bank_name}</strong><span>{account.account_number}</span><small>{account.account_name}</small></button>)}</div>}<label>Your name<input value={form.senderName} onChange={(event) => setForm({ ...form, senderName: event.target.value })} /></label><label>Transfer reference<input value={form.transferReference} onChange={(event) => setForm({ ...form, transferReference: event.target.value })} /></label><label>Payment proof<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setProofFile(event.target.files?.[0] || null)} /></label>{depositError && <p className="form-error" role="alert">{depositError}</p>}<button className="primary-button full" disabled={busy} onClick={submit}>{busy ? 'Submitting...' : 'Submit deposit request'}</button></>}
      {mode === 'withdraw' && <><p className="sheet-copy">Only your withdrawable balance can be requested. Available now: <strong>{money(withdrawable)}</strong></p><label>Withdrawal amount<input type="number" min="0" step="0.01" placeholder="Amount in naira" value={form.amount} onChange={(event) => { setWithdrawalError(''); setForm({ ...form, amount: event.target.value }) }} /></label>{withdrawalMessage && <p className="form-error" role="alert">{withdrawalMessage}</p>}<label>Payout account<select value={form.payoutAccountId} onChange={(event) => setForm({ ...form, payoutAccountId: event.target.value })}><option value="">Select payout account</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.bank_name} · {account.account_number}</option>)}</select></label>{form.amount && !withdrawalMessage && <div className="withdrawal-preview"><span>Available balance <b>{money(withdrawable)}</b></span><span>Withdrawal amount <b>{money(amountMinor)}</b></span><span>Remaining balance <b>{money(withdrawable - amountMinor)}</b></span></div>}{withdrawalError && withdrawalError !== withdrawalMessage && <p className="form-error" role="alert">{withdrawalError}</p>}<button className="primary-button full" disabled={busy || Boolean(withdrawalMessage) || !form.payoutAccountId} onClick={submit}>{busy ? 'Submitting...' : 'Withdraw'}</button></>}
      {mode === 'account' && <><label>Bank name<input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} /></label><label>Account name<input value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} /></label><label>Account number<input inputMode="numeric" maxLength={10} value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} /></label><button className="primary-button full" disabled={busy} onClick={submit}>{busy ? 'Saving...' : 'Save payout account'}</button></>}
    </section></div>}
  </div>
}
