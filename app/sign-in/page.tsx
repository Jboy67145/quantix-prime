import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AuthForm } from '@/components/auth-form'

export default async function SignInPage() {
  const session = await auth.getSession()
  if (session?.user) redirect('/')
  return <main className="auth-shell"><div className="auth-panel"><div className="brand-lockup"><div className="brand-mark">Q</div><div><strong>quantix</strong><span>PRIME</span></div></div><p className="eyebrow">Secure access</p><h1>Welcome back</h1><p className="auth-copy">Sign in to see your balance, investments, and community activity.</p><AuthForm mode="sign-in" /><p className="auth-switch">New to Quantix Prime? <Link href="/sign-up">Create an account</Link></p></div></main>
}
