import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { ShieldCheck, Users, MessageSquare, CreditCard, KeyRound, Activity, LogOut, RefreshCw, Search, LockKeyhole } from 'lucide-react'
import './admin.css'

const sections = [
  ['overview','Overview',Activity],['enquiries','Enquiries',MessageSquare],['customers','Customers',Users],
  ['payments','Payments',CreditCard],['licenses','Licenses',KeyRound],['activity','Audit logs',ShieldCheck]
]
const tables = { enquiries:'tx_enquiries', customers:'tx_customers', payments:'tx_payments', licenses:'tx_licenses', activity:'tx_audit_logs' }

export default function AdminPanel() {
  const [session,setSession] = useState(null)
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [error,setError] = useState('')
  const [section,setSection] = useState('overview')
  const [rows,setRows] = useState([])
  const [counts,setCounts] = useState({})
  const [loading,setLoading] = useState(false)
  const [search,setSearch] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({data}) => setSession(data.session))
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s) => setSession(s))
    return () => subscription.unsubscribe()
  },[])

  const owner = session?.user?.app_metadata?.role === 'owner_admin'
  async function login(e) {
    e.preventDefault(); setError('')
    if (!supabase) return setError('Admin connection is not configured yet.')
    const {data,error} = await supabase.auth.signInWithPassword({email,password})
    if (error) return setError(error.message)
    if (data.user?.app_metadata?.role !== 'owner_admin') {
      await supabase.auth.signOut()
      return setError('Access denied. This account is not the TRADEXO Owner Admin.')
    }
    setSession(data.session)
  }
  async function load() {
    if (!owner || !supabase) return
    setLoading(true)
    const names = Object.entries(tables)
    const results = await Promise.all(names.map(async ([key,table]) => {
      const {data,error} = await supabase.from(table).select('*').order('created_at',{ascending:false}).limit(100)
      return [key,error ? [] : data || []]
    }))
    const map = Object.fromEntries(results); setCounts(Object.fromEntries(results.map(([k,v])=>[k,v.length])))
    setRows(map[section] || []); setLoading(false)
  }
  useEffect(()=>{ if(owner) load() },[owner,section])
  const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
  const title = sections.find(s=>s[0]===section)?.[1] || 'Overview'

  if (!session || !owner) return <div className="tx-admin-login"><form className="tx-login-card" onSubmit={login}>
    <div className="tx-mark">B</div><div className="tx-kicker">TRADEXO • OWNER CONSOLE</div><h1>Admin sign in</h1>
    <p>Secure access for the authorised owner only.</p>
    <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Owner email"/></label>
    <label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></label>
    {error && <div className="tx-error">{error}</div>}
    <button className="tx-primary" type="submit"><LockKeyhole size={17}/> Sign in securely</button>
    <a href="/" className="tx-back">← Back to TRADEXO website</a>
    <small>Owner access is granted separately by the system administrator. Public sign-up is disabled.</small>
  </form></div>

  return <div className="tx-admin">
    <aside className="tx-sidebar"><a href="/" className="tx-admin-brand"><span className="tx-mark">B</span><span>TRADEXO<small>OWNER CONSOLE</small></span></a>
      <div className="tx-nav-label">WORKSPACE</div>{sections.map(([id,label,Icon])=><button key={id} className={section===id?'active':''} onClick={()=>setSection(id)}><Icon size={18}/>{label}</button>)}
      <div className="tx-sidebar-bottom"><span>Signed in as Owner Admin</span><button onClick={()=>supabase.auth.signOut()}><LogOut size={17}/> Sign out</button></div>
    </aside>
    <main className="tx-admin-main"><header><div><span className="tx-kicker">TRADEXO MANAGEMENT</span><h1>{title}</h1></div><button className="tx-refresh" onClick={load}><RefreshCw size={16}/> Refresh</button></header>
      {section==='overview' ? <><div className="tx-stat-grid">{[['Customers',counts.customers],['Enquiries',counts.enquiries],['Payments',counts.payments],['Licenses',counts.licenses]].map(([n,v])=><article key={n}><span>{n}</span><strong>{v ?? '—'}</strong><small>Latest 100 records loaded</small></article>)}</div><div className="tx-welcome"><ShieldCheck size={28}/><div><h2>Owner control centre</h2><p>Manage enquiries, customer records, manual payment verification and software licenses. All sensitive data is restricted by database policies.</p></div></div></> :
      <section className="tx-data-card"><div className="tx-data-head"><div><h2>{title}</h2><span>{rows.length} records loaded</span></div><div className="tx-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records"/></div></div>
      {loading ? <p className="tx-empty">Loading records…</p> : filtered.length===0 ? <p className="tx-empty">No records found yet.</p> : <div className="tx-table-wrap"><table><thead><tr>{Object.keys(filtered[0]).slice(0,7).map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id || i}>{Object.keys(r).slice(0,7).map(k=><td key={k}>{typeof r[k]==='object' ? JSON.stringify(r[k]) : String(r[k] ?? '—')}</td>)}</tr>)}</tbody></table></div>}
      </section>}
      <footer className="tx-admin-footer">Developed & Maintained by FIXBYTE INDIA • TRADEXO Admin</footer>
    </main>
  </div>
}
