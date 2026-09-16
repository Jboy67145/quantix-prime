'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { requestPasswordReset } from '@/lib/auth-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage('')
    setError('')
    const result = await requestPasswordReset(email.trim())
    if (result.error) setError('We could not send the reset email. Check the address and try again.')
    else setMessage('If an account exists for that email, we sent a password reset link.')
    setPending(false)
  }

  return <main className="auth-shell"><div className="auth-panel"><div className="brand-lockup"><div className="brand-mark">Q</div><div><strong>quantix</strong><span>PRIME</span></div></div><p className="eyebrow">Account recovery</p><h1>Reset your password</h1><p className="auth-copy">Enter the email connected to your Quantix Prime account and we&apos;ll send a secure reset link.</p><form className="auth-form" onSubmit={submit}><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-success" role="status">{message}</p>}<button className="primary-button full" disabled={pending}>{pending ? 'Sending link…' : 'Send reset link'}</button></form><p className="auth-switch"><Link href="/sign-in">Back to sign in</Link></p></div></main>
}
