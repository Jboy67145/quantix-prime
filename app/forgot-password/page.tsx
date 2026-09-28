'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { requestPasswordReset } from '@/lib/auth-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true); setMessage(''); setError('')
    try {
      const { error } = await requestPasswordReset(email)
      if (error) throw new Error(error.message || 'Unable to send reset email.')
      setMessage('If an account exists for this email, a secure reset link has been sent. Check your inbox and spam folder.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send the reset email. Please try again.')
    } finally { setPending(false) }
  }

  return <main className="auth-shell"><div className="auth-panel">
    <div className="brand-lockup"><div className="brand-mark">Q</div><div><strong>quantix</strong><span>PRIME</span></div></div>
    <p className="eyebrow">Account recovery</p><h1>Forgot your password?</h1>
    <p className="auth-copy">Enter the email connected to your Quantix Prime account and we&apos;ll send a secure link to choose a new password.</p>
    <form className="auth-form" onSubmit={submit}>
      <label>Email address<input type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="auth-success" role="status">{message}</p>}
      <button className="primary-button full" disabled={pending}>{pending ? 'Sending secure link…' : 'Send reset link'}</button>
    </form>
    <p className="auth-switch"><Link href="/sign-in">← Back to secure sign in</Link></p>
  </div></main>
}
