export function getClientAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (!configured) throw new Error('Missing application URL.')
  const url = new URL(configured)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid application URL.')
  return url.toString().replace(/\/+$/, '')
}
