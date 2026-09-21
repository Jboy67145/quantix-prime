import { listPaymentAccounts } from '@/app/actions/payment-accounts'
import { redirect } from 'next/navigation'
import AccountEditor from './account-editor'

export const metadata = { title: 'Payment Accounts | Quantix Operations', robots: { index: false, follow: false } }

export default async function PaymentAccountsPage() {
  let accounts
  try { accounts = await listPaymentAccounts() } catch (error) { if (error instanceof Error && error.message === 'Unauthorized') redirect('/sign-in?next=/admin/accounts'); if (error instanceof Error && error.message === 'Super-admin access required') redirect('/qx7-ops-4m9k2'); throw error }
  return <main className="admin-shell"><div className="admin-frame"><a className="auth-link" href="/qx7-ops-4m9k2">← Operations portal</a><div className="admin-page-heading"><p className="eyebrow">SUPER ADMIN CONTROL</p><h1>Deposit accounts</h1><p className="admin-muted">Manage the receiving accounts users see when they submit a deposit.</p></div><AccountEditor initialAccounts={accounts} /></div></main>
}
