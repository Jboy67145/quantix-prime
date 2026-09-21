'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { provisionInitialAdmin } from './actions'

export function AdminSetupForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter()
  const [email] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [setupSecret, setSetupSecret] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [countdown, setCountdown] = useState(100)
  useEffect(() => { if (!success) return; const started = Date.now(); const timer = window.setInterval(() => setCountdown(Math.max(0, 100 - Math.round(((Date.now() - started) / 5000) * 100))), 100); return () => window.clearInterval(timer) }, [success])
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError('')
    try { await provisionInitialAdmin(email, password, setupSecret); setSuccess(true) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to provision administrator access.') }
    finally { setPending(false) }
  }
  if (success) return <section className="auth-card admin-success-card"><div className="success-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--i': index } as React.CSSProperties} />)}</div><div className="success-check" aria-hidden="true">✓</div><h1>Administrator login created</h1><p>Your administrator account is active and ready.</p><div className="success-countdown" aria-live="polite">Access confirmed · {countdown}%</div><button className="primary-button full" onClick={() => router.replace('/qx7-ops-4m9k2')}>Continue to dashboard</button></section>
  return <section className="auth-card"><p className="eyebrow">Private operations setup</p><h1>Create administrator access</h1><p className="auth-subtitle">Use the dedicated administrator email to create or activate the first Supabase administrator account.</p><form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly /></label><label>Password<input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label><label>One-time setup secret<input type="password" required value={setupSecret} onChange={(e) => setSetupSecret(e.target.value)} autoComplete="off" /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button full" disabled={pending}>{pending ? 'Creating secure access…' : 'Create administrator account'}</button></form></section>
}
