import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { ShieldCheck, Users, MessageSquare, CreditCard, KeyRound, Activity, LogOut, RefreshCw, Search, LockKeyhole, AlertTriangle } from 'lucide-react'
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
  const [tableErrors,setTableErrors] = useState({})
  const [loading,setLoading] = useState(false)
  const [search,setSearch] = useState('')

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({data,error}) => {
      if (!alive) return
      if (error) setError(error.message)
      setSession(data?.session || null)
    })
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s) => {
      if (alive) setSession(s)
    })
    return () => { alive = false; subscription.unsubscribe() }
  },[])

  const owner = session?.user?.app_metadata?.role === 'owner_admin'
  const load = useCallback(async () => {
    if (!owner || !supabase) return
    setLoading(true)
    setTableErrors({})
    const names = Object.entries(tables)
    const results = await Promise.all(names.map(async ([key,table]) => {
      const {data,error} = await supabase.from(table).select('*').order('created_at',{ascending:false}).limit(100)
      return [key,data || [],error?.message || null]
    }))
    const map = Object.fromEntries(results.map(([key,data])=>[key,data]))
    const errors = Object.fromEntries(results.filter(([, ,message])=>message).map(([key,,message])=>[key,message]))
    setCounts(Object.fromEntries(results.map(([key,data])=>[key,data.length])))
    setTableErrors(errors)
    setRows(map[section] || [])
    setLoading(false)
  },[owner,section])

  useEffect(()=>{ if(owner) load() },[owner,section,load])
  const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
  const title = sections.find(s=>s[0]===section)?.[1] || 'Overview'

  async function login(e) {
    e.preventDefault(); setError('')
    if (!supabase) return setError('Admin connection is not configured. Add the Supabase website environment variables first.')
    const {data,error} = await supabase.auth.signInWithPassword({email,password})
    if (error) return setError(error.message)
    if (data.user?.app_metadata?.role !== 'owner_admin') {
      await supabase.auth.signOut()
      return setError('Access denied. This account is not the TRADEXO Owner Admin.')
    }
    setSession(data.session)
    setPassword('')
  }

  if (!session || !owner) return <div className="tx-admin-login"><form className="tx-login-card" onSubmit={login}>
    <div className="tx-mark">T</div><div className="tx-kicker">TRADEXO • OWNER CONSOLE</div><h1>Admin sign in</h1>
    <p>Secure access for the authorised owner only.</p>
    <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Owner email"/></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></label>
    {error && <div className="tx-error" role="alert">{error}</div>}
    <button className="tx-primary" type="submit"><LockKeyhole size={17}/> Sign in securely</button>
    <a href="/" className="tx-back">← Back to TRADEXO website</a>
    <small>Owner access is assigned through trusted Supabase app metadata. Public sign-up is disabled.</small>
  </form></div>

  return <div className="tx-admin">
    <aside className="tx-sidebar"><a href="/" className="tx-admin-brand"><span className="tx-mark">T</span><span>TRADEXO<small>OWNER CONSOLE</small></span></a>
      <div className="tx-nav-label">WORKSPACE</div>{sections.map(([id,label,Icon])=><button key={id} className={section===id?'active':''} onClick={()=>{setSection(id);setSearch('')}}><Icon size={18}/>{label}</button>)}
      <div className="tx-sidebar-bottom"><span>Signed in as Owner Admin</span><button onClick={()=>supabase.auth.signOut()}><LogOut size={17}/> Sign out</button></div>
    </aside>
    <main className="tx-admin-main"><header><div><span className="tx-kicker">TRADEXO MANAGEMENT</span><h1>{title}</h1></div><button className="tx-refresh" onClick={load} disabled={loading}><RefreshCw size={16}/> {loading?'Refreshing…':'Refresh'}</button></header>
      {Object.keys(tableErrors).length>0 && <div className="tx-data-warning" role="alert"><AlertTriangle size={18}/><div><b>Some admin data could not be loaded.</b><p>{Object.entries(tableErrors).map(([key,message])=>`${tables[key]}: ${message}`).join(' • ')}</p><small>Apply the TRADEXO admin database migration and confirm the owner_admin role before relying on these records.</small></div></div>}
      {section==='overview' ? <><div className="tx-stat-grid">{[['Customers',counts.customers],['Enquiries',counts.enquiries],['Payments',counts.payments],['Licenses',counts.licenses]].map(([n,v])=><article key={n}><span>{n}</span><strong>{v ?? '—'}</strong><small>{tableErrors[{Customers:'customers',Enquiries:'enquiries',Payments:'payments',Licenses:'licenses'}[n]]?'Could not load':'Latest 100 records'}</small></article>)}</div><div className="tx-welcome"><ShieldCheck size={28}/><div><h2>Owner control centre</h2><p>Review enquiries, customer records, payment status, software licenses and audit history. Customer records are read-only here; destructive deletion is not provided.</p></div></div><div className="tx-welcome tx-readonly"><LockKeyhole size={24}/><div><h2>License actions are not enabled yet</h2><p>This release provides secure owner sign-in and read-only record review. Payment verification, license issuance, renewal and suspension will be enabled only after their server-side authorization workflows are implemented.</p></div></div></> :
      <section className="tx-data-card"><div className="tx-data-head"><div><h2>{title}</h2><span>{rows.length} records loaded (up to 100)</span></div><div className="tx-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records"/></div></div>
      {loading ? <p className="tx-empty">Loading records…</p> : tableErrors[section] ? <p className="tx-empty">This table could not be loaded. See the warning above.</p> : filtered.length===0 ? <p className="tx-empty">No records found yet.</p> : <div className="tx-table-wrap"><table><thead><tr>{Object.keys(filtered[0]).slice(0,7).map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id || i}>{Object.keys(r).slice(0,7).map(k=><td key={k}>{typeof r[k]==='object' ? JSON.stringify(r[k]) : String(r[k] ?? '—')}</td>)}</tr>)}</tbody></table></div>}
      </section>}
      <footer className="tx-admin-footer">Developed & Maintained by FIXBYTE INDIA • TRADEXO Admin</footer>
    </main>
  </div>
}
