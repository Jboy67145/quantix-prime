'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn, signUp } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const isSignUp = mode === 'sign-up'
  useEffect(() => { if (isSignUp) setReferralCode(new URLSearchParams(window.location.search).get('ref') || '') }, [isSignUp])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const result = isSignUp
        ? await signUp.email({ name, username, email, password, referralCode })
        : await signIn.email({ email, password })
      if (result.error) {
        const message = result.error.message?.toLowerCase() || ''
        if (message.includes('invalid login credentials')) setError('Email or password is incorrect.')
        else if (message.includes('email not confirmed')) setError('Please confirm your email address before signing in.')
        else if (message.includes('already registered') || message.includes('already been registered')) setError('An account with this email already exists. Try signing in instead.')
        else if (message.includes('password')) setError('Password must be at least 8 characters.')
        else setError(result.error.message || 'We could not complete that request. Please try again.')
        setPending(false)
        return
      }
      if (isSignUp && !result.data.session) {
        setError('Account created. Check your email to confirm your account, then sign in.')
        setPending(false)
        return
      }
      router.replace('/')
      router.refresh()
    } catch {
      setError('Authentication service is temporarily unavailable. Please try again.')
      setPending(false)
    }
  }

  async function resendVerification() {
    setResending(true); setResendMessage(''); setError('')
    try {
      const response = await fetch('/api/auth/resend-confirmation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to resend verification email.')
      setResendMessage('Verification email sent. Check your inbox and spam folder.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to resend verification email.') } finally { setResending(false) }
  }

  return <form className="auth-form" onSubmit={submit}>
    {isSignUp && <><label>Username<input autoComplete="username" pattern="[A-Za-z0-9_]{3,24}" minLength={3} maxLength={24} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="e.g. japhet_prime" required /></label><label>Full name<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Referral code <span className="muted">(optional)</span><input autoComplete="off" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="Enter a referral code" maxLength={32} /></label></>}
    <label>Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
    <label>Password<input type="password" minLength={8} autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {resendMessage && <p className="auth-success" role="status">{resendMessage}</p>}
    <button className="primary-button full" disabled={pending}>{pending ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in securely'}</button>
    {!isSignUp && <button type="button" className="auth-link" disabled={resending || !email} onClick={resendVerification}>{resending ? 'Sending verification email…' : 'Resend verification email'}</button>}
    {!isSignUp && <Link className="auth-link auth-forgot" href="/forgot-password">Forgot password?</Link>}
  </form>
}
