'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp } from '@/lib/auth-client'
import { promoteInitialAdmin } from './actions'

const ADMIN_EMAIL = 'jboy67145@gmail.com'

export function AdminSetupForm() {
  const router = useRouter()
  const [email, setEmail] = useState(ADMIN_EMAIL)
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [countdown, setCountdown] = useState(100)
  useEffect(() => { if (!success) return; const started = Date.now(); const timer = window.setInterval(() => setCountdown(Math.max(0, 100 - Math.round(((Date.now() - started) / 5000) * 100))), 100); return () => window.clearInterval(timer) }, [success])
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError('')
    try {
      const signInResult = await signIn.email({ email, password })
      if (signInResult.error) {
        const message = signInResult.error.message.toLowerCase()
        if (message.includes('email not confirmed')) {
          const resend = await fetch('/api/auth/resend-confirmation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
          const result = await resend.json().catch(() => ({}))
          if (!resend.ok) throw new Error(result.error || 'We could not resend the confirmation email.')
          throw new Error('A fresh confirmation email was sent. Check your inbox and spam folder, confirm the account, then return here and sign in.')
        }
        if (!message.includes('invalid login')) throw new Error(signInResult.error.message)
        const signUpResult = await signUp.email({ email, password })
        if (signUpResult.error) throw new Error(signUpResult.error.message)
        if (!signUpResult.data.session) throw new Error('A confirmation email was sent. Check your inbox and spam folder, confirm the account, then return here and sign in.')
      }
      await promoteInitialAdmin(); setSuccess(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to provision administrator access.') } finally { setPending(false) }
  }
  async function resendConfirmation() {
    setResending(true); setResendMessage(''); setError('')
    try {
      const response = await fetch('/api/auth/resend-confirmation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Unable to resend confirmation email.')
      setResendMessage('Confirmation email sent. Check your inbox and spam folder.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to resend confirmation email.') } finally { setResending(false) }
  }
  if (success) return <section className="auth-card admin-success-card"><div className="success-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--i': index } as React.CSSProperties} />)}</div><div className="success-check" aria-hidden="true">✓</div><h1>Administrator login created</h1><p>Your administrator account is active and ready.</p><div className="success-countdown" aria-live="polite">Access confirmed · {countdown}%</div><button className="primary-button full" onClick={() => router.replace('/qx7-ops-4m9k2')}>Continue to dashboard</button></section>
  return <section className="auth-card"><p className="eyebrow">Private operations setup</p><h1>Create administrator access</h1><p className="auth-subtitle">Use the dedicated administrator email to create or activate the first Supabase administrator account.</p><form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly /></label><label>Password<input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>{error && <p className="auth-error" role="alert">{error}</p>}{resendMessage && <p className="auth-success" role="status">{resendMessage}</p>}<button className="primary-button full" disabled={pending}>{pending ? 'Creating secure access…' : 'Create administrator account'}</button><button type="button" className="text-button" disabled={pending || resending} onClick={resendConfirmation}>{resending ? 'Sending confirmation email…' : 'Resend confirmation email'}</button></form></section>
}
