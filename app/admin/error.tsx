'use client'

import { useEffect } from 'react'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[v0] Admin dashboard error', error)
  }, [error])

  return (
    <main className="admin-shell">
      <div className="admin-frame">
        <div className="admin-error">
          Unable to load the admin dashboard. Please sign in with an administrator account and try again.
        </div>
        <button className="secondary-button" onClick={() => reset()}>Retry</button>
      </div>
    </main>
  )
}
