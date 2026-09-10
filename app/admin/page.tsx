'use client'

import { useEffect, useState } from 'react'
import { Check, Clock3, FileText, ShieldAlert, X } from 'lucide-react'
import { getPendingDeposits, reviewDeposit } from '@/app/actions/admin'

export default function AdminPage() {
  const [deposits, setDeposits] = useState<any[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  useEffect(() => { getPendingDeposits().then(setDeposits).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load review queue')) }, [])
  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    setBusy(id); setError('')
    try { await reviewDeposit({ id, status }); setDeposits((items) => items.filter((item) => item.id !== id)) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to review deposit') } finally { setBusy('') }
  }
  return <main className="admin-shell"><div className="admin-frame"><div className="admin-header"><div className="brand-lockup"><div className="brand-mark">Q</div><div><strong>quantix</strong><span>PRIME ADMIN</span></div></div><div className="admin-status"><i /> Secure review console</div></div><section className="admin-hero"><div><p className="eyebrow">Operations</p><h1>Deposit review</h1><p>Review transfer proofs before funds are credited to member wallets.</p></div><div className="admin-stat"><Clock3 size={18} /><strong>{deposits.length}</strong><span>pending</span></div></section>{error && <div className="admin-error"><ShieldAlert size={17} />{error}</div>}<section className="admin-queue">{deposits.length === 0 ? <div className="admin-empty"><Check size={26} /><h2>Queue is clear</h2><p>No deposits need attention right now.</p></div> : deposits.map((deposit) => <article className="admin-item" key={deposit.id}><div className="admin-item-top"><div className="admin-file"><FileText size={19} /></div><div><strong>{deposit.transferReference}</strong><span>{deposit.senderName || 'Sender not provided'} · {new Date(deposit.createdAt).toLocaleString()}</span></div><b>₦{(deposit.amountMinor / 100).toLocaleString()}</b></div><div className="admin-meta"><span>Member ID</span><code>{deposit.userId}</code></div><div className="admin-actions"><button className="admin-reject" disabled={busy === deposit.id} onClick={() => review(deposit.id, 'REJECTED')}><X size={16} /> Reject</button><button className="admin-approve" disabled={busy === deposit.id} onClick={() => review(deposit.id, 'APPROVED')}><Check size={16} /> Approve</button></div></article>)}</section></div></main>
}
