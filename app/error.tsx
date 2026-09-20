'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[v0] Route rendering error', error)
  }, [error])

  return <main className="auth-shell"><div className="auth-panel"><p className="eyebrow">Quantix Prime</p><h1>We could not load this page</h1><p className="auth-copy">The application encountered a temporary error. Try again, or return to secure sign in.</p><button className="primary-button full" onClick={() => reset()}>Try again</button><a className="auth-link" href="/sign-in">Return to sign in</a></div></main>
}
