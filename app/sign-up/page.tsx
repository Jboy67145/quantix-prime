import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AuthForm } from '@/components/auth-form'

export default async function SignUpPage() {
  const session = await auth.getSession()
  if (session?.user) redirect('/')
  return <main className="auth-shell"><div className="auth-panel"><div className="brand-lockup"><div className="brand-mark">Q</div><div><strong>quantix</strong><span>PRIME</span></div></div><p className="eyebrow">Build with clarity</p><h1>Create your account</h1><p className="auth-copy">Start with verified access to individual plans, wallet tools, and community rewards.</p><AuthForm mode="sign-up" /><p className="auth-switch">Already a member? <Link href="/sign-in">Sign in</Link></p></div></main>
}
