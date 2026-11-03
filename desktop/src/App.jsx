import React, { useEffect, useState } from 'react'
import { BarChart3, Boxes, Building2, ChevronRight, CircleHelp, FileText, Home, LockKeyhole, Moon, Package, Settings, ShoppingCart, Sun, Wallet } from 'lucide-react'
const nav=[['Overview',Home],['Invoices',FileText],['Sales',ShoppingCart],['Purchases',Wallet],['Customers',Building2],['Products & Stock',Boxes],['Warehouse',Package],['Reports',BarChart3],['Company Settings',Settings]]
function DataWorkspace({type}) {
 const isCustomers = type === 'customers'
 const api = typeof window !== 'undefined' ? window.bizora?.database : null
 const [items,setItems] = useState([])
 const [loading,setLoading] = useState(true)
 const [saving,setSaving] = useState(false)
 const [error,setError] = useState('')
 const [notice,setNotice] = useState('')
 const [form,setForm] = useState({name:'',phone:'',email:'',address:'',sku:'',unit:'pcs',sellingPrice:'0',openingStock:'0'})
 async function load() {
  if (!api) { setLoading(false); return }
  setLoading(true); setError('')
  try { setItems(isCustomers ? await api.listCustomers() : await api.listProducts()) }
  catch (e) { setError(e.message || 'Could not load local records.') }
  finally { setLoading(false) }
 }
 useEffect(()=>{ load() },[type])
 function update(key,value) { setForm(current=>({...current,[key]:value})) }
 async function submit(e) {
  e.preventDefault(); if (!api) return
  setSaving(true); setError(''); setNotice('')
  try {
   if (isCustomers) await api.createCustomer({name:form.name,phone:form.phone,email:form.email,address:form.address})
   else await api.createProduct({name:form.name,sku:form.sku,unit:form.unit,sellingPrice:form.sellingPrice,openingStock:form.openingStock})
   setForm({name:'',phone:'',email:'',address:'',sku:'',unit:'pcs',sellingPrice:'0',openingStock:'0'})
   setNotice(isCustomers ? 'Customer saved on this PC.' : 'Product saved on this PC.')
   await load()
  } catch (e) { setError(e.message || 'Could not save this record.') }
  finally { setSaving(false) }
 }
 const field = (key,label,placeholder=label,type='text') => <label className="db-field">{label}<input required={key==='name'} type={type} value={form[key]} placeholder={placeholder} onChange={e=>update(key,e.target.value)}/></label>
 return <div className="db-workspace">
  <div className="db-heading"><div><h2>{isCustomers?'Customers':'Products & Stock'}</h2><p>{isCustomers?'Save customer contact details locally on this computer.':'Create your local product catalogue and opening stock.'}</p></div><span className="db-count">{items.length} records</span></div>
  {!api ? <div className="panel db-empty"><LockKeyhole/><b>Open the BIZORA Windows desktop app</b><p>Local database access is available inside the Electron desktop app, not the browser preview.</p></div> : <>
   <form className="panel db-form" onSubmit={submit}><div className="panel-title"><b>{isCustomers?'Add customer':'Add product'}</b><span>Saved locally</span></div>
    <div className="db-fields">{field('name',isCustomers?'Customer name':'Product name')}
     {isCustomers ? <>{field('phone','Phone number','Optional phone','tel')}{field('email','Email','Optional email','email')}{field('address','Address','Optional address')}</> : <>{field('sku','SKU / Code','Optional SKU')}{field('unit','Unit','pcs')}{field('sellingPrice','Selling price','0','number')}{field('openingStock','Opening stock','0','number')}</>}
    </div>
    {error&&<p className="db-error">{error}</p>}{notice&&<p className="db-success">{notice}</p>}
    <button className="db-save" disabled={saving}>{saving?'Saving…':isCustomers?'Save customer':'Save product'}</button>
   </form>
   <div className="panel db-list"><div className="panel-title"><b>{isCustomers?'Customer records':'Product records'}</b><button type="button" className="db-refresh" onClick={load}>Refresh</button></div>
    {loading?<p className="db-muted">Loading records…</p>:items.length===0?<p className="db-muted">No records yet. Add your first {isCustomers?'customer':'product'} above.</p>:
     <div className="db-table-wrap"><table><thead><tr>{(isCustomers?['Name','Phone','Email','Address','Created']:['Product','SKU','Unit','Selling price','Opening stock']).map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{items.map(item=><tr key={item.id}>{(isCustomers?[item.name,item.phone,item.email,item.address,item.created_at?.slice(0,10)]:[item.name,item.sku,item.unit,'₹'+Number(item.selling_price).toFixed(2),item.opening_stock]).map((v,i)=><td key={i}>{v||'—'}</td>)}</tr>)}</tbody></table></div>}
   </div>
  </>}
 </div>
}
function CompanyWorkspace(){
 const api=typeof window!=='undefined'?window.bizora?.database:null
 const [companies,setCompanies]=useState([]),[current,setCurrent]=useState(null),[gstins,setGstins]=useState([])
 const [businessName,setBusinessName]=useState(''),[legalName,setLegalName]=useState(''),[gstin,setGstin]=useState(''),[gstinLabel,setGstinLabel]=useState('')
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 async function load(){if(!api)return;const pair=await Promise.all([api.listCompanies(),api.getCurrentCompany()]);setCompanies(pair[0]);setCurrent(pair[1]);setGstins(pair[1]?await api.listCompanyGstins(pair[1].id):[])}
 useEffect(()=>{load().catch(e=>setError(e.message||'Could not load company settings.'))},[])
 async function addCompany(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{const c=await api.createCompany({businessName,legalName});await api.setActiveCompany(c.id);setBusinessName('');setLegalName('');await load();setNotice('Company created and selected.')}catch(e){setError(e.message||'Could not create company.')}finally{setBusy(false)}}
 async function switchCompany(id){setBusy(true);setError('');setNotice('');try{await api.setActiveCompany(id);await load();setNotice('Active company changed.')}catch(e){setError(e.message||'Could not switch company.')}finally{setBusy(false)}}
 async function addGstin(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await api.addCompanyGstin({gstin,label:gstinLabel});setGstin('');setGstinLabel('');await load();setNotice('GSTIN registration saved.')}catch(e){setError(e.message||'Could not save GSTIN.')}finally{setBusy(false)}}
 if(!api)return <div className="panel db-empty"><LockKeyhole/><b>Open the BIZORA Windows desktop app</b><p>Company data is stored locally on this computer.</p></div>
 return <div className="db-workspace">
  <div className="db-heading"><div><h2>Company &amp; GSTIN Settings</h2><p>Keep each company and its GST registrations separate.</p></div><span className="db-count">{companies.length} companies</span></div>
  <div className="panel company-switcher"><div className="panel-title"><b>Active company</b><span>Transactions will use this company context</span></div><div className="company-choice">{companies.map(c=><button type="button" key={c.id} className={current?.id===c.id?'company-choice-active':''} disabled={busy||current?.id===c.id} onClick={()=>switchCompany(c.id)}><b>{c.business_name}</b><small>{c.gstin_count} GSTIN registrations</small><em>{current?.id===c.id?'ACTIVE':'Switch'}</em></button>)}</div></div>
  <div className="panels company-panels">
   <form className="panel db-form" onSubmit={addCompany}><div className="panel-title"><b>Add another company</b><span>Same owner account</span></div><div className="db-fields"><label className="db-field">Business name<input required value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="Business / trade name"/></label><label className="db-field">Legal name (optional)<input value={legalName} onChange={e=>setLegalName(e.target.value)} placeholder="Registered legal name"/></label></div><button className="db-save" disabled={busy}>Create company</button></form>
   <form className="panel db-form" onSubmit={addGstin}><div className="panel-title"><b>Add GSTIN</b><span>{current?.business_name||'Select a company'}</span></div><div className="db-fields"><label className="db-field">15-character GSTIN<input required maxLength={15} value={gstin} onChange={e=>setGstin(e.target.value.toUpperCase())} placeholder="08ABCDE1234F1Z5"/></label><label className="db-field">Label (optional)<input value={gstinLabel} onChange={e=>setGstinLabel(e.target.value)} placeholder="Rajasthan registration"/></label></div><button className="db-save" disabled={busy||!current}>Save GSTIN</button></form>
  </div>
  {error&&<p className="db-error">{error}</p>}{notice&&<p className="db-success">{notice}</p>}
  <div className="panel db-list"><div className="panel-title"><b>GSTIN registrations for {current?.business_name||'active company'}</b><span>Format validation only; not government verification</span></div>{gstins.length===0?<p className="db-muted">No GSTIN added for this company yet.</p>:<div className="db-table-wrap"><table><thead><tr><th>GSTIN</th><th>State code</th><th>Label</th><th>Status</th></tr></thead><tbody>{gstins.map(g=><tr key={g.id}><td>{g.gstin}</td><td>{g.state_code}</td><td>{g.label||'—'}</td><td>{g.status}</td></tr>)}</tbody></table></div>}</div>
  <p className="db-muted">Company records are isolated in the local database. GSTIN format checks do not confirm registration status with the GST portal.</p>
 </div>
}
export default function App(){
 const [active,setActive]=useState('Overview'),[dark,setDark]=useState(false)
 return <div className={dark?'app dark':'app'}><aside className="sidebar"><div className="logo"><b>B</b><span>BIZO<span>RA</span><small>BUSINESS WORKSPACE</small></span></div><div className="company"><Building2 size={17}/><span>My Business<small>Basic Plan</small></span><ChevronRight size={15}/></div><small className="nav-label">WORKSPACE</small>{nav.map(([name,Icon])=><button className={active===name?'selected':''} onClick={()=>setActive(name)} key={name}><Icon size={17}/>{name}</button>)}<div className="side-bottom"><div className="upgrade"><LockKeyhole size={18}/><b>Premium features</b><p>Unlock advanced tools when your plan is activated.</p><button onClick={()=>setActive('Upgrade')}>Talk to Specialist</button></div><button onClick={()=>setDark(!dark)}><Moon size={17}/> Switch appearance {dark?<Sun size={15}/>:null}</button><div className="user"><div>AB</div><span>Business Owner<small>Basic workspace</small></span></div></div></aside><main className="main"><header><div><span className="crumb">Workspace / </span>{active}</div><div className="header-right"><span className="offline"><i/> Offline-ready design</span><button className="help"><CircleHelp size={17}/></button></div></header><section className="content"><div className="welcome"><div><small>YOUR BUSINESS, AT A GLANCE</small><h1>{active==='Overview'?'Good day.':active}</h1><p>This is your BIZORA desktop preview. Business features will be added in phases.</p></div><span className="date">PROJECT 521 · PREVIEW</span></div>{active==='Overview'?<><div className="stats"><div><small>Total sales</small><b>₹ —</b><em>No transactions yet</em></div><div><small>Outstanding</small><b>₹ —</b><em>Awaiting data</em></div><div><small>Products</small><b>—</b><em>Not configured</em></div><div><small>Low stock items</small><b>—</b><em>Not configured</em></div></div><div className="panels"><article className="panel chart-panel"><div className="panel-title"><b>Business activity</b><span>Will appear after setup</span></div><div className="empty-chart"><BarChart3 size={35}/><b>Your business insights will appear here</b><p>Add your first invoice or purchase to get started.</p></div></article><article className="panel"><div className="panel-title"><b>Quick actions</b><span>Basic workspace</span></div>{['Create invoice','Add a product','Add a customer','Record an expense'].map((x,i)=><button className="quick" key={x} onClick={()=>setActive(x==='Add a product'?'Products & Stock':x==='Add a customer'?'Customers':x)}><span>{['＋','▦','♙','₹'][i]}</span>{x}<ChevronRight size={15}/></button>)}</article></div><div className="locked"><div><LockKeyhole/><span><b>Premium systems are visible, but locked</b><small>Advanced GST, multi-company, POS, barcode and advanced reports.</small></span></div><button onClick={()=>setActive('Upgrade')}>View upgrade options <ChevronRight size={15}/></button></div></>:active==='Customers'?<DataWorkspace type="customers"/>:active==='Products & Stock'?<DataWorkspace type="products"/>:active==='Company Settings'?<CompanyWorkspace/>:<div className="panel placeholder"><LockKeyhole size={28}/><h2>{active}</h2><p>This module is part of the BIZORA build roadmap. It is not active in this starter preview.</p><button onClick={()=>setActive('Overview')}>Back to overview</button></div>}<footer>BIZORA · Developed & Maintained by FIXBYTE INDIA</footer></section></main></div>
}
