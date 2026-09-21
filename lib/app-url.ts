export function getClientAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (configured) {
    const url = new URL(configured)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid application URL.')
    return url.toString().replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined') return window.location.origin
  throw new Error('Missing application URL.')
}
