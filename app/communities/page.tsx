import { ArrowLeft, ExternalLink, ShieldCheck, Users } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function CommunitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: communities, error } = await supabase
    .from('quantix_communities')
    .select('id,name,description,join_url,icon_url,active')
    .eq('active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  return <main className="auth-shell">
    <div className="auth-panel" style={{ maxWidth: 560 }}>
      <a className="secondary-button inline-flex" href="/?tab=me"><ArrowLeft size={16} /> Back to Me</a>
      <div className="brand-lockup" style={{ marginTop: 18 }}>
        <div className="brand-mark logo-brand"><img src="/icon.svg" alt="Quantix Prime" /></div>
        <div><strong>quantix</strong><span>PRIME</span></div>
      </div>
      <p className="eyebrow">Community center</p>
      <h1>Join our communities</h1>
      <p className="auth-copy">Connect with the official Quantix Prime communities. Choose a community below and use its secure join button to continue.</p>

      {error ? <p className="auth-error" role="alert">Unable to load the community directory right now. Please try again.</p> :
       !communities?.length ? <div className="account-tile"><Users size={18}/><span><strong>No communities available</strong><small>Please check back later.</small></span></div> :
       <div style={{ display:'grid', gap:12, marginTop:18 }}>
         {communities.map((community:any) => <article key={community.id} className="account-tile" style={{ alignItems:'flex-start', padding:16 }}>
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
