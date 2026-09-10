'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const result = isSignUp
      ? await signUp.email({ name, email, password })
      : await signIn.email({ email, password })
    if (result.error) {
      setError('We could not complete that request. Check your details and try again.')
      setPending(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return <form className="auth-form" onSubmit={submit}>
    {isSignUp && <label>Full name<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></label>}
    <label>Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
    <label>Password<input type="password" minLength={8} autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="primary-button full" disabled={pending}>{pending ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in securely'}</button>
  </form>
}
