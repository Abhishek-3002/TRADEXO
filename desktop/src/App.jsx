import React, { useEffect, useState } from 'react'
import { BarChart3, Boxes, Building2, ChevronRight, CircleHelp, FileText, Home, LockKeyhole, Moon, Package, Settings, ShoppingCart, Sun, Wallet } from 'lucide-react'
const nav=[['Overview',Home],['Invoices',FileText],['Sales',ShoppingCart],['Purchases',Wallet],['Customers',Building2],['Products & Stock',Boxes],['Warehouse',Package],['Reports',BarChart3],['Company Settings',Settings]]
export default 
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
\nfunction App(){
 const [active,setActive]=useState('Overview'),[dark,setDark]=useState(false)
 return <div className={dark?'app dark':'app'}><aside className="sidebar"><div className="logo"><b>B</b><span>BIZO<span>RA</span><small>BUSINESS WORKSPACE</small></span></div><div className="company"><Building2 size={17}/><span>My Business<small>Basic Plan</small></span><ChevronRight size={15}/></div><small className="nav-label">WORKSPACE</small>{nav.map(([name,Icon])=><button className={active===name?'selected':''} onClick={()=>setActive(name)} key={name}><Icon size={17}/>{name}</button>)}<div className="side-bottom"><div className="upgrade"><LockKeyhole size={18}/><b>Premium features</b><p>Unlock advanced tools when your plan is activated.</p><button onClick={()=>setActive('Upgrade')}>Talk to Specialist</button></div><button onClick={()=>setDark(!dark)}><Moon size={17}/> Switch appearance {dark?<Sun size={15}/>:null}</button><div className="user"><div>AB</div><span>Business Owner<small>Basic workspace</small></span></div></div></aside><main className="main"><header><div><span className="crumb">Workspace / </span>{active}</div><div className="header-right"><span className="offline"><i/> Offline-ready design</span><button className="help"><CircleHelp size={17}/></button></div></header><section className="content"><div className="welcome"><div><small>YOUR BUSINESS, AT A GLANCE</small><h1>{active==='Overview'?'Good day.':active}</h1><p>This is your BIZORA desktop preview. Business features will be added in phases.</p></div><span className="date">PROJECT 521 · PREVIEW</span></div>{active==='Overview'?<><div className="stats"><div><small>Total sales</small><b>₹ —</b><em>No transactions yet</em></div><div><small>Outstanding</small><b>₹ —</b><em>Awaiting data</em></div><div><small>Products</small><b>—</b><em>Not configured</em></div><div><small>Low stock items</small><b>—</b><em>Not configured</em></div></div><div className="panels"><article className="panel chart-panel"><div className="panel-title"><b>Business activity</b><span>Will appear after setup</span></div><div className="empty-chart"><BarChart3 size={35}/><b>Your business insights will appear here</b><p>Add your first invoice or purchase to get started.</p></div></article><article className="panel"><div className="panel-title"><b>Quick actions</b><span>Basic workspace</span></div>{['Create invoice','Add a product','Add a customer','Record an expense'].map((x,i)=><button className="quick" key={x} onClick={()=>setActive(x==='Add a product'?'Products & Stock':x==='Add a customer'?'Customers':x)}><span>{['＋','▦','♙','₹'][i]}</span>{x}<ChevronRight size={15}/></button>)}</article></div><div className="locked"><div><LockKeyhole/><span><b>Premium systems are visible, but locked</b><small>Advanced GST, multi-company, POS, barcode and advanced reports.</small></span></div><button onClick={()=>setActive('Upgrade')}>View upgrade options <ChevronRight size={15}/></button></div></>:active==='Customers'?<DataWorkspace type="customers"/>:active==='Products & Stock'?<DataWorkspace type="products"/>:<div className="panel placeholder"><LockKeyhole size={28}/><h2>{active}</h2><p>This module is part of the BIZORA build roadmap. It is not active in this starter preview.</p><button onClick={()=>setActive('Overview')}>Back to overview</button></div>}<footer>BIZORA · Developed & Maintained by FIXBYTE INDIA</footer></section></main></div>
}
