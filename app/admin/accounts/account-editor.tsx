'use client'

import { useState } from 'react'
import { savePaymentAccount, setPaymentAccountActive } from '@/app/actions/payment-accounts'

type Account = { id: string; bank_name: string; account_number: string; account_name: string; label: string; active: boolean; display_order: number }
type Draft = Omit<Account, 'id'> & { id?: string }

const blank: Draft = { bank_name: '', account_number: '', account_name: '', label: '', active: true, display_order: 1 }

export default function AccountEditor({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [draft, setDraft] = useState<Draft>(blank)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function edit(account: Account) { setDraft(account); setMessage(''); setError('') }
  function update(key: keyof Draft, value: string | boolean) { setDraft((current) => ({ ...current, [key]: value })) }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('')
    try { const saved = await savePaymentAccount({ ...draft, displayOrder: Number(draft.display_order), bankName: draft.bank_name, accountNumber: draft.account_number, accountName: draft.account_name, label: draft.label, active: draft.active }); setAccounts((current) => { const next = current.filter((item) => item.id !== saved.id); return [...next, saved].sort((a, b) => a.display_order - b.display_order) }); setDraft(blank); setMessage('Payment account saved.') } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save account.') } finally { setBusy(false) }
  }
  async function toggle(account: Account) { setBusy(true); setError(''); try { const saved = await setPaymentAccountActive(account.id, !account.active); setAccounts((current) => current.map((item) => item.id === saved.id ? saved : item)); setMessage(saved.active ? 'Account activated.' : 'Account hidden from users.') } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update account.') } finally { setBusy(false) } }
  return <section className="admin-account-editor"><div className="admin-editor-grid"><div><div className="admin-section-title"><div><p className="eyebrow">RECEIVING ACCOUNTS</p><h2>Visible to depositors</h2></div><span className="admin-count">{accounts.filter((account) => account.active).length} active</span></div><div className="admin-account-list">{accounts.map((account) => <article className={`admin-account-card ${account.active ? '' : 'is-inactive'}`} key={account.id}><div><span className="admin-account-order">#{account.display_order}</span><strong>{account.bank_name}</strong><p>{account.account_name}</p><code>{account.account_number}</code><small>{account.label}</small></div><div className="admin-account-actions"><span className={`admin-status ${account.active ? 'active' : ''}`}>{account.active ? 'Visible' : 'Hidden'}</span><button className="secondary-button" type="button" onClick={() => edit(account)}>Edit</button><button className="secondary-button" type="button" disabled={busy} onClick={() => toggle(account)}>{account.active ? 'Hide' : 'Show'}</button></div></article>)}</div></div><form className="admin-editor-form" onSubmit={submit}><div className="admin-section-title"><div><p className="eyebrow">ACCOUNT EDITOR</p><h2>{draft.id ? 'Edit account' : 'Add account'}</h2></div>{draft.id && <button className="auth-link" type="button" onClick={() => setDraft(blank)}>New account</button>}</div><label>Provider<input value={draft.bank_name} onChange={(event) => update('bank_name', event.target.value)} maxLength={80} required /></label><label>Account number<input value={draft.account_number} onChange={(event) => update('account_number', event.target.value)} inputMode="numeric" maxLength={32} required /></label><label>Account name<input value={draft.account_name} onChange={(event) => update('account_name', event.target.value)} maxLength={120} required /></label><label>Display label<input value={draft.label} onChange={(event) => update('label', event.target.value)} maxLength={160} required /></label><label>Display order<input type="number" min="0" max="999" value={draft.display_order} onChange={(event) => update('display_order', event.target.value)} required /></label><label className="admin-checkbox"><input type="checkbox" checked={draft.active} onChange={(event) => update('active', event.target.checked)} /> Show this account to users</label>{error && <p className="admin-error" role="alert">{error}</p>}{message && <p className="admin-success" role="status">{message}</p>}<button className="primary-button full" disabled={busy}>{busy ? 'Saving…' : 'Save payment account'}</button></form></div></section>
}
