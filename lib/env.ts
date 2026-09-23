function readRequired(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function getAppUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL?.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).replace(/\/+$/, '')
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('NEXT_PUBLIC_APP_URL must use http or https.')
  return url.toString().replace(/\/+$/, '')
}

export function getSupabasePublicConfig() {
  const url = readRequired('NEXT_PUBLIC_SUPABASE_URL')
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!key) throw new Error('Missing Supabase publishable key.')
  return { url, key }
}
