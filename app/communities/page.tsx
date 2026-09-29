'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Users, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { getCommunities } from '@/app/actions/communities'

type Community = {
  id: string
  name: string
  description: string | null
  join_url: string
  icon_url: string | null
  active: boolean
}

export default function CommunitiesPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isPending) return
    if (!session?.user) {
      router.replace('/sign-in')
      return
    }
    getCommunities()
      .then((rows) => setCommunities(rows as Community[]))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load communities.'))
      .finally(() => setLoading(false))
  }, [isPending, session?.user, router])

  if (isPending || !session?.user) {
    return <main className="auth-shell"><div className="auth-panel"><p className="auth-copy">Loading your community center…</p></div></main>
  }

  return <main className="auth-shell">
    <div className="auth-panel" style={{ maxWidth: 560 }}>
      <button type="button" className="secondary-button" onClick={() => router.push('/?tab=me')}><ArrowLeft size={16} /> Back to Me</button>
      <div className="brand-lockup" style={{ marginTop: 18 }}>
        <div className="brand-mark logo-brand"><img src="/icon.svg" alt="Quantix Prime" /></div>
        <div><strong>quantix</strong><span>PRIME</span></div>
      </div>
      <p className="eyebrow">Community center</p>
      <h1>Join our communities</h1>
      <p className="auth-copy">Connect with the official Quantix Prime communities. Choose a community below and use its secure join button to continue to the community.</p>

      {loading ? <p className="auth-copy">Loading available communities…</p> :
       error ? <p className="auth-error" role="alert">{error}</p> :
       communities.length === 0 ? <div className="account-tile"><Users size={18}/><span><strong>No communities available</strong><small>Please check back later.</small></span></div> :
       <div style={{ display:'grid', gap:12, marginTop:18 }}>
         {communities.map((community) => <article key={community.id} className="account-tile" style={{ alignItems:'flex-start', padding:16 }}>
           <div className="menu-icon">{community.icon_url ? <img src={community.icon_url} alt="" style={{ width:20, height:20, borderRadius:'50%', objectFit:'cover' }} /> : <Users size={18}/>}</div>
           <div style={{ flex:1, minWidth:0 }}>
             <strong>{community.name}</strong>
             {community.description && <small style={{ whiteSpace:'normal', lineHeight:1.45 }}>{community.description}</small>}
             <a className="primary-button full" href={community.join_url} target="_blank" rel="noopener noreferrer" style={{ marginTop:12 }}>
               <ExternalLink size={16} /> Join Community
             </a>
           </div>
         </article>)}
       </div>}
      <p className="auth-copy" style={{ marginTop:18, display:'flex', gap:8, alignItems:'center' }}><ShieldCheck size={15}/> Official community links are managed by Quantix Prime Administration.</p>
    </div>
  </main>
}
