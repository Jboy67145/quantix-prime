'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Quantix Prime] Global application error', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
          <section style={{ width: '100%', maxWidth: '440px', border: '1px solid rgba(255,255,255,.12)', borderRadius: '28px', padding: '28px', background: 'rgba(255,255,255,.05)', textAlign: 'center' }}>
            <strong style={{ letterSpacing: '.18em', fontSize: '11px', opacity: .55 }}>QUANTIX PRIME</strong>
            <h1 style={{ margin: '12px 0 8px', fontSize: '24px' }}>Something went wrong</h1>
            <p style={{ margin: 0, lineHeight: 1.6, opacity: .65, fontSize: '14px' }}>The application could not complete this request. Please try again.</p>
            {error.digest && <p style={{ marginTop: '18px', wordBreak: 'break-all', fontSize: '11px', opacity: .4 }}>Reference: {error.digest}</p>}
            <button onClick={() => reset()} style={{ marginTop: '20px', width: '100%', border: 0, borderRadius: '16px', padding: '13px 16px', background: '#fff', color: '#000', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
          </section>
        </main>
      </body>
    </html>
  )
}
