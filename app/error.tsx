'use client'

import { useEffect } from 'react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Quantix Prime] Unhandled application error', error)
  }, [error])

  return (
    <main className="min-h-screen bg-black px-5 py-16 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg font-semibold">Q</div>
        <p className="text-xs uppercase tracking-[0.2em] opacity-50">Quantix Prime</p>
        <h1 className="mt-2 text-2xl font-semibold">We couldn’t complete that request</h1>
        <p className="mt-3 text-sm leading-6 opacity-65">
          The operation encountered an unexpected problem. No partial action should be assumed. Please try again.
        </p>
        {error.digest && (
          <p className="mt-4 break-all rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] opacity-45">
            Reference: {error.digest}
          </p>
        )}
        <button type="button" className="primary-button mt-5 w-full justify-center" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </main>
  )
}
