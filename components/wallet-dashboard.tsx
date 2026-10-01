'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Check, Clock3, Copy, ExternalLink, FileText, Landmark, RefreshCw, WalletCards } from 'lucide-react'
import { getWalletDetails, getUserPayoutAccounts, addPayoutAccount, deletePayoutAccount, requestWithdrawal, uploadDepositProof, submitWalletDeposit } from '@/app/actions/wallet'
import { getPaymentAccounts } from '@/app/actions/investments'

const money = (minor: number) => `₦${(Number(minor || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
type WalletData = { wallet: any; deposits: any[]; withdrawals: any[]; accounts: any[]; withdrawalSettings?: any }
type Mode = 'deposit' | 'withdraw' | 'account' | null

export function WalletDashboard({ notify }: { notify: (message: string) => void }) {
  const [data, setData] = useState<WalletData>({ wallet: null, deposits: [], withdrawals: [], accounts: [] })
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [fundingAccounts, setFundingAccounts] = useState<any[]>([])
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [withdrawalError, setWithdrawalError] = useState('')
  const [depositError, setDepositError] = useState('')
  const [depositReference, setDepositReference] = useState('')
  const [depositStep, setDepositStep] = useState<1 | 2>(1)
  const router = useRouter()
  const [copiedDepositDetails, setCopiedDepositDetails] = useState(false)
  const [form, setForm] = useState({ amount: '', payoutAccountId: '', paymentAccountId: '', senderName: '', transferReference: '', bankName: '', accountName: '', accountNumber: '' })
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [sheetDragOffset, setSheetDragOffset] = useState(0)
  const [sheetDragging, setSheetDragging] = useState(false)
  const sheetScrollRef = useRef<HTMLDivElement>(null)
  const sheetDragStartY = useRef(0)
  const sheetDragStartExpanded = useRef(false)
  const refresh = () => getWalletDetails().then(setData).catch((error) => notify(error instanceof Error ? error.message : 'Unable to load wallet'))
  useEffect(() => {
    const openDeposit = () => openMode('deposit')
    window.addEventListener('quantix:open-deposit', openDeposit)
    refresh()
    getPaymentAccounts().then(setFundingAccounts).catch(() => setDepositError('We could not load deposit accounts. Please try again.'))
    const timer = window.setInterval(refresh, 15000)
    return () => { window.clearInterval(timer); window.removeEventListener('quantix:open-deposit', openDeposit) }
  }, [])
  const available = Number(data.wallet?.available_minor || 0)
  const invested = Number(data.wallet?.invested_minor || 0)
  const pending = data.withdrawals.filter((item) => ['PENDING', 'PROCESSING'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount_minor || 0), 0)
  const withdrawable = Math.max(0, available - pending)
  const minimumWithdrawalMinor = Number(data.withdrawalSettings?.minimum_minor ?? 100000)
  const maximumWithdrawalMinor = data.withdrawalSettings?.maximum_minor == null ? null : Number(data.withdrawalSettings.maximum_minor)
  const amountMinor = Math.round(Number(form.amount || 0) * 100)
  const withdrawalMessage = useMemo(() => {
    if (mode !== 'withdraw') return ''
    if (!form.amount) return ''
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) return 'Withdrawal amount must be greater than ₦0.'
    if (amountMinor < minimumWithdrawalMinor) return `Minimum withdrawal is ${money(minimumWithdrawalMinor)}.`
    if (maximumWithdrawalMinor !== null && amountMinor > maximumWithdrawalMinor) return `Maximum withdrawal is ${money(maximumWithdrawalMinor)}.`
    if (amountMinor > withdrawable) return withdrawable === 0 ? 'Insufficient funds. Your available balance is ₦0.00.' : `Insufficient funds. You can withdraw up to ${money(withdrawable)}.`
    return ''
  }, [amountMinor, form.amount, mode, withdrawable, minimumWithdrawalMinor, maximumWithdrawalMinor])
  const openMode = (next: Mode) => { setSheetExpanded(false); setSheetDragOffset(0); setMode(next); setDepositStep(1); setWithdrawalError(''); setDepositError(''); setProofFile(null); setCopiedDepositDetails(false); setDepositReference(next === 'deposit' ? `QP-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}` : ''); setForm({ amount: '', payoutAccountId: '', paymentAccountId: '', senderName: '', transferReference: '', bankName: '', accountName: '', accountNumber: '' }); if (next === 'deposit') { setDepositError(''); getPaymentAccounts().then((accounts) => { setFundingAccounts(accounts); if (!accounts.length) setDepositError('No active deposit accounts are available right now.') }).catch(() => setDepositError('We could not load deposit accounts. Please refresh and try again.')) } }
  const closeMode = () => { setSheetExpanded(false); setSheetDragOffset(0); setSheetDragging(false); setMode(null); setDepositStep(1); setWithdrawalError(''); setDepositError(''); setProofFile(null) }
  useEffect(() => {
    if (!mode) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    return () => { document.body.style.overflow = previousOverflow }
  }, [mode])

  const handleSheetScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!sheetExpanded && event.currentTarget.scrollTop > 2) {
      event.currentTarget.scrollTop = 0
      setSheetExpanded(true)
      setSheetDragOffset(0)
    }
  }

  const handleSheetPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    sheetDragStartY.current = event.clientY
    sheetDragStartExpanded.current = sheetExpanded
    setSheetDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleSheetPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!sheetDragging) return
    const delta = event.clientY - sheetDragStartY.current
    if (sheetDragStartExpanded.current) {
      setSheetDragOffset(Math.max(0, Math.min(delta, window.innerHeight * 0.5)))
    } else {
      setSheetDragOffset(Math.min(0, Math.max(delta, -window.innerHeight * 0.5)))
    }
  }

  const finishSheetPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!sheetDragging) return
    const delta = event.clientY - sheetDragStartY.current
    const threshold = Math.max(48, window.innerHeight * 0.08)
    if (sheetDragStartExpanded.current && delta > threshold) {
      setSheetExpanded(false)
    } else if (!sheetDragStartExpanded.current && delta < -threshold) {
      setSheetExpanded(true)
    }
    setSheetDragOffset(0)
    setSheetDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const copyValue = async (key: string, value: any) => { try { await navigator.clipboard.writeText(String(value ?? '')); setCopiedDepositDetails(true); window.setTimeout(() => setCopiedDepositDetails(false), 1400) } catch { setDepositError('Unable to copy. Please select the text manually.') } }
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
        if (form.senderName.trim().length < 2) throw new Error('Enter the sender name used for the transfer.')
        if (!proofFile) throw new Error('Please upload your payment proof.')
        const uploadedProof = await uploadDepositProof(proofFile)
        await submitWalletDeposit({ amountMinor: depositAmount, paymentAccountId: form.paymentAccountId, depositReference, senderName: form.senderName, transferReference: form.transferReference, proofPathname: uploadedProof.path, proofHash: uploadedProof.proofHash })
      }
      notify(mode === 'withdraw' ? 'Withdrawal request submitted' : mode === 'deposit' ? 'Deposit request submitted for review' : 'Payout account saved')
      closeMode(); refresh(); if (mode === 'deposit') { router.replace('/?tab=home'); router.refresh() }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not complete this request. Please try again.'
      if (mode === 'withdraw') setWithdrawalError(message); else if (mode === 'deposit') setDepositError(message); else notify(message)
    } finally { setBusy(false) }
  }
  const withdrawalWindow = data.withdrawalSettings?.enabled ? `${data.withdrawalSettings.start_time}–${data.withdrawalSettings.end_time}` : 'currently closed'
  const activities = [...data.deposits.map((item) => ({ ...item, kind: 'Deposit', amount: item.amount_minor })), ...data.withdrawals.map((item) => ({ ...item, kind: 'Withdrawal', amount: item.amount_minor }))].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 8)
  return <div className="screen-content">
    <div className="page-header"><div><p className="eyebrow">Money center</p><h1>Wallet</h1></div><button className="icon-button" aria-label="Refresh wallet" onClick={refresh}><RefreshCw size={17} /></button></div>
    <section className="balance-card wallet-balance"><div className="balance-top"><span>Total balance</span><span className="live-pill"><i /> Live</span></div><strong>{money(available + invested)}</strong><div className="balance-meta"><span>Available {money(available)}</span><span>Invested {money(invested)}</span></div></section>
    <section className="balance-breakdown"><div><small>Withdrawable</small><strong>{money(withdrawable)}</strong></div><div><small>Pending / locked</small><strong>{money(pending)}</strong></div><div><small>Expected profit</small><strong>{money(data.wallet?.profit_minor || 0)}</strong></div></section>
    <div className="wallet-actions"><button onClick={() => openMode('deposit')}><span><ArrowDownToLine size={18} /></span>Deposit</button><button onClick={() => openMode('withdraw')}><span><ArrowUpFromLine size={18} /></span>Withdraw</button><button onClick={() => openMode('account')}><span><Landmark size={18} /></span>Payout account</button></div>
    <section className="section-block"><div className="section-heading"><h2>Payout accounts</h2><span className="muted">{data.accounts.length}/2 saved</span></div>{data.accounts.length ? data.accounts.map((account) => <div className="account-tile" key={account.id}><Landmark size={17} /><span><strong>{account.bank_name}</strong><small>{account.account_name} · {account.account_number}</small></span>{account.is_default && <b className="status-success">Default</b>}<button className="icon-button" aria-label="Remove payout account" title="Remove account" onClick={async () => { if (!window.confirm('Remove this payout account? It will no longer be available for withdrawals.')) return; try { await deletePayoutAccount(account.id); refresh() } catch (e) { notify(e instanceof Error ? e.message : 'Unable to remove payout account.') } }}><span aria-hidden="true">🗑</span></button></div>) : <div className="empty-state"><WalletCards size={24} /><h2>No payout account</h2><p>Add an account before requesting a withdrawal.</p></div>}</section>
    <section className="section-block"><div className="section-heading"><h2>Deposit requests</h2><span className="muted">Your submissions</span></div><div className="activity-list">{data.deposits.map((item) => <div className="rounded-2xl border border-white/10 bg-black/20 p-4" key={item.id}><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{money(Number(item.amount_minor || 0))}</strong><div className="text-xs opacity-60">{new Date(item.created_at).toLocaleString('en-NG')}</div></div><small className={item.status === 'APPROVED' ? 'status-success' : item.status === 'REJECTED' ? 'status-pending' : 'status-pending'}>{item.status}</small></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><span className="block text-xs opacity-50">Deposit Reference</span><span className="break-all font-medium">{item.deposit_reference || '—'}</span></div><div><span className="block text-xs opacity-50">Sender name</span><span>{item.sender_name || '—'}</span></div><div><span className="block text-xs opacity-50">Bank transaction reference</span><span className="break-all">{item.transfer_reference || '—'}</span></div><div><span className="block text-xs opacity-50">Deposit account</span><span>{fundingAccounts.find((account) => account.id === item.payment_account_id)?.bank_name || 'Submitted account'} · {fundingAccounts.find((account) => account.id === item.payment_account_id)?.account_number || '—'}</span></div><div><span className="block text-xs opacity-50">Proof</span>{item.proof_url ? <a className="inline-flex items-center gap-1 underline" href={`/api/deposit-proof?pathname=${encodeURIComponent(item.proof_url)}`} target="_blank" rel="noreferrer">View submitted proof <ExternalLink size={13}/></a> : <span>—</span>}</div></div></div>)}{!data.deposits.length && <div className="empty-state"><FileText size={22} /><p>No deposit requests yet.</p></div>}</div></section>
    <section className="section-block"><div className="section-heading"><h2>Wallet activity</h2><span className="muted">Recent</span></div><div className="activity-list">{activities.map((item) => <div className="activity-row" key={`${item.kind}-${item.id}`}><div className="activity-icon emerald">{item.kind === 'Deposit' ? <ArrowDownToLine size={17} /> : <ArrowUpFromLine size={17} />}</div><div className="activity-copy"><strong>{item.kind}</strong><span>{new Date(item.created_at).toLocaleDateString('en-NG')}</span></div><b className={item.kind === 'Deposit' ? 'positive' : 'negative'}>{item.kind === 'Deposit' ? '+' : '-'}{money(item.amount)}</b><small className={item.status === 'APPROVED' ? 'status-success' : 'status-pending'}>{item.status}</small></div>)}{!activities.length && <div className="empty-state"><Clock3 size={22} /><p>No wallet activity yet.</p></div>}</div></section>
    {mode && <div className="sheet-backdrop" onClick={closeMode}><section
          className={`sheet qp-transaction-sheet ${sheetExpanded ? 'is-expanded' : 'is-medium'} ${sheetDragging ? 'is-dragging' : ''}`}
          style={{ transform: `translate3d(0, ${sheetDragOffset}px, 0)` }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wallet-action-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className="sheet-handle-area"
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={finishSheetPointer}
            onPointerCancel={finishSheetPointer}
          >
            <div className="sheet-handle" />
          </div>
          <div className="sheet-title sheet-header">
            <div><p className="eyebrow">Wallet action</p><h2 id="wallet-action-title">{mode === 'withdraw' ? 'Withdraw funds' : mode === 'account' ? 'Add payout account' : 'Deposit funds'}</h2></div><button className="icon-button" onClick={closeMode} aria-label="Close wallet action">×</button>
          </div>
          <div ref={sheetScrollRef} className="sheet-scroll" onScroll={handleSheetScroll}>
      {mode === 'deposit' && <>{depositStep === 1 ? <><div className="sheet-step-title"><div><p className="eyebrow">Step 1 of 2</p><h2>Make your deposit</h2></div></div><p className="sheet-copy">Enter the amount, choose the Quantix receiving account, then use the generated Deposit Reference with your transfer.</p><label>Deposit amount<input type="number" min="1" step="0.01" placeholder="Amount in naira" value={form.amount} onChange={(event) => { setDepositError(''); setForm({ ...form, amount: event.target.value }) }} /></label><div className="funding-account-list"><p className="eyebrow">Select receiving account</p>{fundingAccounts.length ? fundingAccounts.map((account) => <div className={form.paymentAccountId === account.id ? 'funding-account selected' : 'funding-account'} key={account.id}><div className="flex-1 cursor-pointer" onClick={() => setForm({ ...form, paymentAccountId: account.id })}><div className="space-y-2"><div className="flex items-center justify-between gap-3"><span className="text-xs opacity-50">Bank name</span><div className="flex min-w-0 items-center gap-2"><strong className="truncate">{account.bank_name}</strong><button type="button" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1 text-current opacity-80 transition hover:bg-white/10" aria-label={`Copy bank name: ${account.bank_name}`} title="Copy bank name" onClick={(event) => { event.stopPropagation(); copyValue(account.id+':bank', account.bank_name) }}><Copy size={13}/></button></div></div><div className="flex items-center justify-between gap-3"><span className="text-xs opacity-50">Account name</span><div className="flex min-w-0 items-center gap-2"><span className="truncate font-medium">{account.account_name}</span><button type="button" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1 text-current opacity-80 transition hover:bg-white/10" aria-label={`Copy account name: ${account.account_name}`} title="Copy account name" onClick={(event) => { event.stopPropagation(); copyValue(account.id+':name', account.account_name) }}><Copy size={13}/></button></div></div><div className="flex items-center justify-between gap-3"><span className="text-xs opacity-50">Account number</span><div className="flex min-w-0 items-center gap-2"><span className="truncate font-medium tracking-wide">{account.account_number}</span><button type="button" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1 text-current opacity-80 transition hover:bg-white/10" aria-label={`Copy account number: ${account.account_number}`} title="Copy account number" onClick={(event) => { event.stopPropagation(); copyValue(account.id+':number', account.account_number) }}><Copy size={13}/></button></div></div></div></div></div>) : <p className="form-error">No active deposit accounts are available right now.</p>}</div><div className="rounded-3xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-wider opacity-50">Quantix Deposit Reference</p><strong className="mt-1 block text-xl tracking-wider">{depositReference || 'Generating…'}</strong><p className="mt-2 text-xs opacity-55">Keep this reference with your transfer. It is separate from any bank transaction reference.</p><button type="button" className="secondary-button mt-3" onClick={async () => { await navigator.clipboard.writeText(depositReference); setCopiedDepositDetails(true); window.setTimeout(() => setCopiedDepositDetails(false), 1800) }}>{copiedDepositDetails ? <Check size={15}/> : <Copy size={15}/>} {copiedDepositDetails ? 'Copied' : 'Copy reference'}</button></div>{depositError && <p className="form-error" role="alert">{depositError}</p>}<button className="primary-button full" disabled={busy || !form.amount || !form.paymentAccountId} onClick={() => { setDepositError(''); setDepositStep(2) }}>I have made the deposit <ArrowDownToLine size={16}/></button></> : <><div className="sheet-title"><div><p className="eyebrow">Step 2 of 2</p><h2>Submit payment proof</h2></div><button className="icon-button" aria-label="Back to deposit details" onClick={() => setDepositStep(1)}><ArrowLeft size={18}/></button></div><p className="sheet-copy">Enter the details from your payment receipt and upload the proof. Your Quantix Deposit Reference is already attached to this request.</p><div className="rounded-3xl border border-white/10 bg-white/5 p-4"><div className="text-xs opacity-50">Quantix Deposit Reference</div><strong className="mt-1 block tracking-wider">{depositReference}</strong></div><label>Your name<input value={form.senderName} onChange={(event) => setForm({ ...form, senderName: event.target.value })} /></label><label>Bank transaction reference <span className="opacity-50">(optional)</span><input placeholder="Leave blank if you do not have one" value={form.transferReference} onChange={(event) => setForm({ ...form, transferReference: event.target.value })} /><span className="mt-1 block text-xs opacity-50">Use the reference shown on your bank receipt if available. You can still submit without one.</span></label><label>Payment proof<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setProofFile(event.target.files?.[0] || null)} /><span className="mt-1 block text-xs opacity-50">Upload the original receipt for this transaction.</span></label>{depositError && <p className="form-error" role="alert">{depositError}</p>}<div className="grid grid-cols-2 gap-2"><button type="button" className="secondary-button" disabled={busy} onClick={() => setDepositStep(1)}><ArrowLeft size={15}/> Back</button><button className="primary-button" disabled={busy || !form.senderName.trim() || !proofFile} onClick={submit}>{busy ? 'Submitting...' : 'Submit deposit proof'}</button></div></>}</>}
      {mode === 'withdraw' && <><p className="sheet-copy">Minimum withdrawal: <strong>{money(minimumWithdrawalMinor)}</strong>{maximumWithdrawalMinor !== null ? <> · Maximum: <strong>{money(maximumWithdrawalMinor)}</strong></> : null}. Available now: <strong>{money(withdrawable)}</strong>.</p><p className="text-xs opacity-60">Withdrawal hours: {withdrawalWindow} ({data.withdrawalSettings?.timezone || 'Africa/Lagos'}).</p><label>Withdrawal amount<input type="number" min="0" step="0.01" placeholder="Amount in naira" value={form.amount} onChange={(event) => { setWithdrawalError(''); setForm({ ...form, amount: event.target.value }) }} /></label>{withdrawalMessage && <p className="form-error" role="alert">{withdrawalMessage}</p>}<label>Payout account<select value={form.payoutAccountId} onChange={(event) => setForm({ ...form, payoutAccountId: event.target.value })}><option value="">Select payout account</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.bank_name} · {account.account_number}</option>)}</select></label>{form.amount && !withdrawalMessage && <div className="withdrawal-preview"><span>Available balance <b>{money(withdrawable)}</b></span><span>Withdrawal amount <b>{money(amountMinor)}</b></span><span>Remaining balance <b>{money(withdrawable - amountMinor)}</b></span></div>}{withdrawalError && withdrawalError !== withdrawalMessage && <p className="form-error" role="alert">{withdrawalError}</p>}<button className="primary-button full" disabled={busy || Boolean(withdrawalMessage) || !form.payoutAccountId} onClick={submit}>{busy ? 'Submitting...' : 'Withdraw'}</button></>}
      {mode === 'account' && <><label>Bank name<input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} /></label><label>Account name<input value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} /></label><label>Account number<input inputMode="numeric" maxLength={10} value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} /></label><button className="primary-button full" disabled={busy} onClick={submit}>{busy ? 'Saving...' : 'Save payout account'}</button></>}
          </div>
        </section></div>}
  </div>
}
