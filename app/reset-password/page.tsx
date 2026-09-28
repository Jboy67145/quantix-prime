'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, updatePassword } from '@/lib/auth-client'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    createClient().auth.getUser().then(({ data, error }) => {
      if (!mounted) return
      if (error || !data.user) setError('This password-reset link is invalid or has expired. Please request a new link.')
      setReady(true)
    }).catch(() => { if (mounted) { setError('We could not verify this reset session. Please request a new link.'); setReady(true) } })
    return () => { mounted = false }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (password.length < 8) return setError('Use at least 8 characters for your new password.')
    if (password.length > 72) return setError('Your new password must be 72 characters or fewer.')
    if (password !== confirmation) return setError('The passwords do not match.')
    setPending(true)
    try {
      const result = await updatePassword(password)
      if (result.error) throw new Error(result.error.message || 'Unable to update your password.')
      setSuccess(true)
      await signOut()
      window.setTimeout(() => router.replace('/sign-in?reset=success'), 700)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not update your password. Please request a new reset link.')
    } finally { setPending(false) }
  }

  return <main className="auth-shell"><div className="auth-panel">
    <div className="brand-lockup"><div className="brand-mark">Q</div><div><strong>quantix</strong><span>PRIME</span></div></div>
    <p className="eyebrow">Secure account recovery</p><h1>{success ? 'Password updated' : 'Choose a new password'}</h1>
    <p className="auth-copy">{success ? 'Your password has been changed securely. You can now sign in with your new password.' : ready ? 'Set a strong new password for your Quantix Prime account.' : 'Verifying your secure reset session…'}</p>
    {ready && error && !success ? <><p className="auth-error" role="alert">{error}</p><Link className="auth-link" href="/forgot-password">Request a new reset link</Link></> : ready && !success ? <form className="auth-form" onSubmit={submit}>
      <label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
      <p className="auth-copy password-hint">Your password is never sent by email. Only the secure reset link is emailed.</p>
      <button className="primary-button full" disabled={pending}>{pending ? 'Updating password…' : 'Set new password'}</button>
    </form> : null}
    {success && <p className="auth-success" role="status">Password reset complete. Redirecting you to secure sign in…</p>}
  </div></main>
}
