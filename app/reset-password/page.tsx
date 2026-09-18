'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePassword } from '@/lib/auth-client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const timer = window.setTimeout(() => setReady(true), 250); return () => window.clearTimeout(timer) }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters for your new password.')
    if (password !== confirmation) return setError('The passwords do not match.')
    setPending(true)
    setError('')
    const result = await updatePassword(password)
    if (result.error) { setError('This reset link is invalid or expired. Request a new one.'); setPending(false); return }
    router.replace('/?reset=success')
    router.refresh()
  }

  return <main className="auth-shell"><div className="auth-panel"><div className="brand-lockup"><div className="brand-mark">Q</div><div><strong>quantix</strong><span>PRIME</span></div></div><p className="eyebrow">Secure account recovery</p><h1>Choose a new password</h1><p className="auth-copy">{ready ? 'Set a new password for your Quantix Prime account.' : 'Verifying your secure reset link…'}</p><form className="auth-form" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button full" disabled={pending || !ready}>{pending ? 'Updating password…' : 'Update password'}</button></form><p className="auth-switch"><Link href="/sign-in">Return to sign in</Link></p></div></main>
}
