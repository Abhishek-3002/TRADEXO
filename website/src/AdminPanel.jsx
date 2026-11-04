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
  const [actionNotice,setActionNotice] = useState('')
  const [busyId,setBusyId] = useState('')
  const [customers,setCustomers] = useState([])
  const [showCustomerForm,setShowCustomerForm] = useState(false)
  const [showPaymentForm,setShowPaymentForm] = useState(false)
  const [customerForm,setCustomerForm] = useState({full_name:'',mobile:'',email:'',company_name:'',business_type:''})
  const [paymentForm,setPaymentForm] = useState({customer_id:'',amount:'1499',payment_method:'UPI',reference_number:'',notes:''})

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
    const results = await Promise.all(Object.entries(tables).map(async ([key,table]) => {
      const {data,error} = await supabase.from(table).select('*').order('created_at',{ascending:false}).limit(100)
      return [key,data || [],error?.message || null]
    }))
    const map = Object.fromEntries(results.map(([key,data])=>[key,data]))
    const errors = Object.fromEntries(results.filter(([, ,message])=>message).map(([key,,message])=>[key,message]))
    setCounts(Object.fromEntries(results.map(([key,data])=>[key,data.length])))
    setCustomers(map.customers || [])
    setTableErrors(errors)
    setRows(map[section] || [])
    setLoading(false)
  },[owner,section])

  useEffect(()=>{ if(owner) load() },[owner,section,load])
  const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
  const title = sections.find(s=>s[0]===section)?.[1] || 'Overview'

  async function activatePayment(payment) {
    if (!window.confirm('Verify this payment and activate or renew the annual TRADEXO license?')) return
    setBusyId(payment.id); setActionNotice('')
    const {data,error} = await supabase.rpc('tx_admin_activate_payment',{p_payment_id:payment.id,p_device_limit:1})
    setBusyId('')
    if (error) return setActionNotice('Activation failed: '+error.message)
    const result = Array.isArray(data) ? data[0] : data
    setActionNotice('License activated. Key: '+(result?.license_key || 'Issued')+' | Plan: '+(result?.plan || '—')+' | Expiry: '+(result?.expires_at ? new Date(result.expires_at).toLocaleDateString() : '—'))
    await load()
  }

  async function changeLicenseStatus(license,status) {
    if (!window.confirm('Change license status to '+status+'?')) return
    setBusyId(license.id); setActionNotice('')
    const {error} = await supabase.rpc('tx_admin_set_license_status',{p_license_id:license.id,p_status:status})
    setBusyId('')
    if (error) return setActionNotice('Status update failed: '+error.message)
    setActionNotice('License status updated to '+status+'.')
    await load()
  }

  async function createCustomer(e) {
    e.preventDefault(); setActionNotice('')
    const payload = { ...customerForm, plan:'basic', status:'active' }
    const {error} = await supabase.from('tx_customers').insert(payload)
    if (error) return setActionNotice('Customer save failed: '+error.message)
    setCustomerForm({full_name:'',mobile:'',email:'',company_name:'',business_type:''})
    setShowCustomerForm(false); setActionNotice('Customer added successfully. You can now record a manual payment for this customer.')
    await load()
  }

  async function recordManualPayment(e) {
    e.preventDefault(); setActionNotice('')
    if (!paymentForm.customer_id) return setActionNotice('Select a customer before recording payment.')
    const payload = { customer_id:paymentForm.customer_id, amount:Number(paymentForm.amount), currency:'INR', payment_method:paymentForm.payment_method, reference_number:paymentForm.reference_number || null, notes:paymentForm.notes || 'Manually received by TRADEXO owner; pending verification.', status:'pending' }
    const {error} = await supabase.from('tx_payments').insert(payload)
    if (error) return setActionNotice('Payment record failed: '+error.message)
    setPaymentForm({customer_id:'',amount:'1499',payment_method:'UPI',reference_number:'',notes:''})
    setShowPaymentForm(false); setActionNotice('Manual payment recorded as Pending. Verify it below only after confirming the money has been received.')
    await load()
  }

  async function login(e) {
    e.preventDefault(); setError('')
    if (!supabase) return setError('Admin connection is not configured. Add the Supabase website environment variables first.')
    const {data,error} = await supabase.auth.signInWithPassword({email,password})
    if (error) return setError(error.message)
    if (data.user?.app_metadata?.role !== 'owner_admin') {
      await supabase.auth.signOut()
      return setError('Access denied. This account is not the TRADEXO Owner Admin.')
    }
    setSession(data.session); setPassword('')
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
      <div className="tx-nav-label">WORKSPACE</div>{sections.map(([id,label,Icon])=><button key={id} className={section===id?'active':''} onClick={()=>{setSection(id);setSearch('');setActionNotice('')}}><Icon size={18}/>{label}</button>)}
      <div className="tx-sidebar-bottom"><span>Signed in as Owner Admin</span><button onClick={()=>supabase.auth.signOut()}><LogOut size={17}/> Sign out</button></div>
    </aside>
    <main className="tx-admin-main"><header><div><span className="tx-kicker">TRADEXO MANAGEMENT</span><h1>{title}</h1></div><button className="tx-refresh" onClick={load} disabled={loading}><RefreshCw size={16}/> {loading?'Refreshing…':'Refresh'}</button></header>
      {Object.keys(tableErrors).length>0 && <div className="tx-data-warning" role="alert"><AlertTriangle size={18}/><div><b>Some admin data could not be loaded.</b><p>{Object.entries(tableErrors).map(([key,message])=>tables[key]+': '+message).join(' • ')}</p><small>Check the TRADEXO database migration and owner_admin role.</small></div></div>}
      {section==='overview' ? <><div className="tx-stat-grid">{[['Customers',counts.customers],['Enquiries',counts.enquiries],['Payments',counts.payments],['Licenses',counts.licenses]].map(([n,v])=><article key={n}><span>{n}</span><strong>{v ?? '—'}</strong><small>Latest 100 records loaded</small></article>)}</div><div className="tx-welcome"><ShieldCheck size={28}/><div><h2>Owner control centre</h2><p>Review enquiries, customer records, payment status, software licenses and audit history. Customer records are read-only here; destructive deletion is not provided.</p></div></div><div className="tx-welcome tx-readonly"><LockKeyhole size={24}/><div><h2>Payment-to-license workflow</h2><p>From Payments, verify an eligible annual INR payment to issue or renew a license. From Licenses, suspend or reactivate a license. Actions are checked server-side and recorded in the audit log.</p></div></div></> :
      <section className="tx-data-card"><div className="tx-data-head"><div><h2>{title}</h2><span>{rows.length} records loaded (up to 100)</span></div><div className="tx-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records"/></div></div>
      {section==='customers' && <button className="tx-row-action" onClick={()=>setShowCustomerForm(v=>!v)}>{showCustomerForm?'Cancel':'＋ Add Customer'}</button>}
      {section==='payments' && <button className="tx-row-action" onClick={()=>setShowPaymentForm(v=>!v)}>{showPaymentForm?'Cancel':'＋ Record Manual Payment'}</button>}
      {section==='customers' && showCustomerForm && <form className="tx-manual-form" onSubmit={createCustomer}><h3>Add customer</h3><div className="tx-form-grid"><label>Customer name<input required value={customerForm.full_name} onChange={e=>setCustomerForm({...customerForm,full_name:e.target.value})}/></label><label>Mobile<input required value={customerForm.mobile} onChange={e=>setCustomerForm({...customerForm,mobile:e.target.value})}/></label><label>Email (optional)<input type="email" value={customerForm.email} onChange={e=>setCustomerForm({...customerForm,email:e.target.value})}/></label><label>Business / company<input value={customerForm.company_name} onChange={e=>setCustomerForm({...customerForm,company_name:e.target.value})}/></label><label>Business type<input value={customerForm.business_type} onChange={e=>setCustomerForm({...customerForm,business_type:e.target.value})}/></label></div><button className="tx-row-action" type="submit">Save customer</button></form>}
      {section==='payments' && showPaymentForm && <form className="tx-manual-form" onSubmit={recordManualPayment}><h3>Record payment received manually</h3><p>Use this only after you receive the payment outside TRADEXO. It will remain pending until you verify it.</p><div className="tx-form-grid"><label>Customer<select required value={paymentForm.customer_id} onChange={e=>setPaymentForm({...paymentForm,customer_id:e.target.value})}><option value="">Select customer</option>{customers.map(x=><option key={x.id} value={x.id}>{x.full_name} — {x.mobile}</option>)}</select></label><label>Annual plan amount<select value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})}><option value="1499">Starter — ₹1,499</option><option value="4999">Business — ₹4,999</option><option value="9999">Enterprise — ₹9,999</option></select></label><label>Payment method<select value={paymentForm.payment_method} onChange={e=>setPaymentForm({...paymentForm,payment_method:e.target.value})}><option>UPI</option><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Other</option></select></label><label>UTR / Reference number<input value={paymentForm.reference_number} onChange={e=>setPaymentForm({...paymentForm,reference_number:e.target.value})} placeholder="Optional reference"/></label><label>Notes<input value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm,notes:e.target.value})} placeholder="Optional payment note"/></label></div><button className="tx-row-action" type="submit">Save as Pending Payment</button></form>}
      {actionNotice && <div className="tx-action-notice" role="status">{actionNotice}</div>}
      {loading ? <p className="tx-empty">Loading records…</p> : tableErrors[section] ? <p className="tx-empty">This table could not be loaded. See the warning above.</p> : filtered.length===0 ? <p className="tx-empty">No records found yet.</p> : <div className="tx-table-wrap"><table><thead><tr>{Object.keys(filtered[0]).slice(0,7).map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}{(section==='payments'||section==='licenses')&&<th>Admin action</th>}</tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id || i}>{Object.keys(r).slice(0,7).map(k=><td key={k}>{typeof r[k]==='object' ? JSON.stringify(r[k]) : String(r[k] ?? '—')}</td>)}{section==='payments'&&<td>{r.status==='pending'?<button className="tx-row-action" disabled={busyId===r.id} onClick={()=>activatePayment(r)}>{busyId===r.id?'Working…':'Verify & Activate'}</button>:<span className="tx-muted">No action</span>}</td>}{section==='licenses'&&<td>{r.status==='active'?<button className="tx-row-action danger" disabled={busyId===r.id} onClick={()=>changeLicenseStatus(r,'suspended')}>Suspend</button>:r.status==='suspended'?<button className="tx-row-action" disabled={busyId===r.id} onClick={()=>changeLicenseStatus(r,'active')}>Reactivate</button>:<span className="tx-muted">No action</span>}</td>}</tr>)}</tbody></table></div>}
      </section>}
      <footer className="tx-admin-footer">Developed & Maintained by FIXBYTE INDIA • TRADEXO Admin</footer>
    </main>
  </div>
}
