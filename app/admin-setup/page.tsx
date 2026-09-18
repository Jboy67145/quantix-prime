import { AdminSetupForm } from './setup-form'

export const metadata = { title: 'Administrator Setup | Quantix Prime', robots: { index: false, follow: false } }

export default function AdminSetupPage() {
  return <main className="auth-shell"><AdminSetupForm /></main>
}
