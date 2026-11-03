import React, { useEffect, useState } from 'react'
import { BarChart3, Boxes, Building2, CalendarDays, ChevronRight, CircleHelp, Database, FileText, Home, LockKeyhole, Moon, Package, Settings, ShoppingCart, Sun, Wallet } from 'lucide-react'
const nav=[['Overview',Home],['Invoices',FileText],['Sales',ShoppingCart],['Purchases',Wallet],['Customers',Building2],['Products & Stock',Boxes],['Warehouse',Package],['Reports',BarChart3],['Company Settings',Settings],['Financial Year & GST',CalendarDays],['Data Backup',Database]]
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
function TradeWorkspace({type='sales'}){
 const api=typeof window!=='undefined'?window.bizora?.database:null,sales=type==='sales'
 const [party,setParty]=useState([]),[products,setProducts]=useState([]),[docs,setDocs]=useState([]),[years,setYears]=useState([])
 const [partyId,setPartyId]=useState(''),[number,setNumber]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[items,setItems]=useState([{productId:'',quantity:'1',price:'0'}]),[vendorName,setVendorName]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 async function load(){if(!api)return;const v=await Promise.all([sales?api.listCustomers():api.listVendors(),api.listProducts(),sales?api.listSalesInvoices():api.listPurchaseBills(),api.listFinancialYears()]);setParty(v[0]);setProducts(v[1]);setDocs(v[2]);setYears(v[3]);if(!partyId&&v[0][0])setPartyId(v[0][0].id);if(!items[0].productId&&v[1][0])setItems([{productId:v[1][0].id,quantity:'1',price:String(sales?v[1][0].selling_price:0)}])}
 useEffect(()=>{load().catch(e=>setError(e.message||'Could not load records.'))},[type])
 function change(i,k,v){setItems(old=>old.map((x,n)=>n===i?{...x,[k]:v}:x))}
 async function save(e){e.preventDefault();setBusy(true);setError('');try{const p=sales?{customerId:partyId,invoiceNumber:number,invoiceDate:date,items:items.map(x=>({productId:x.productId,quantity:x.quantity,unitPrice:x.price}))}:{vendorId:partyId,billNumber:number,billDate:date,items:items.map(x=>({productId:x.productId,quantity:x.quantity,unitCost:x.price}))};if(sales)await api.createSalesInvoiceDraft(p);else await api.createPurchaseBillDraft(p);setNumber('');setNotice('Draft saved. Stock changes only after posting.');await load()}catch(e){setError(e.message||'Could not save.')}finally{setBusy(false)}}
 async function post(id){setBusy(true);setError('');try{if(sales)await api.postSalesInvoice(id);else await api.postPurchaseBill(id);await load();setNotice('Posted. Stock ledger updated.')}catch(e){setError(e.message||'Could not post.')}finally{setBusy(false)}}
 async function reverse(id){
  const reason=window.prompt('Enter the reason for reversing this posted document:')
  if(!reason||!reason.trim())return
  setBusy(true);setError('');setNotice('')
  try{if(sales)await api.reverseSalesInvoice(id,reason);else await api.reversePurchaseBill(id,reason);await load();setNotice('Reversal saved as a compensating stock movement.')}
  catch(e){setError(e.message||'Could not reverse document.')}finally{setBusy(false)}
 }
 async function addVendor(e){e.preventDefault();setBusy(true);try{const v=await api.createVendor({name:vendorName});setVendorName('');await load();setPartyId(v.id);setNotice('Vendor saved.')}catch(e){setError(e.message||'Could not add vendor.')}finally{setBusy(false)}}
 if(!api)return <div className="panel db-empty"><LockKeyhole/><b>Open BIZORA desktop app</b><p>Transaction records are saved locally.</p></div>
 const fy=years.find(x=>x.status==='active'),total=items.reduce((a,x)=>a+(Number(x.quantity)||0)*(Number(x.price)||0),0)
 return <div className="db-workspace"><div className="db-heading"><div><h2>{sales?'Sales invoices':'Purchase bills'}</h2><p>{sales?'Customer billing and stock-out posting.':'Supplier bills and stock-in posting.'}</p></div><span className="db-count">{docs.length} records</span></div>
 <div className="panel db-list"><div className="panel-title"><b>Active financial year</b><span>{fy?.label||'Not configured'}</span></div>{!fy&&<p className="db-error">Create and activate a financial year first.</p>}</div>
 {!sales&&<form className="panel db-form" onSubmit={addVendor}><div className="panel-title"><b>Add vendor</b></div><div className="db-fields"><label className="db-field">Vendor name<input required value={vendorName} onChange={e=>setVendorName(e.target.value)}/></label></div><button className="db-save" disabled={busy}>Save vendor</button></form>}
 <form className="panel db-form" onSubmit={save}><div className="panel-title"><b>{sales?'New invoice draft':'New purchase draft'}</b><span>Draft does not change stock</span></div>
 <div className="db-fields"><label className="db-field">{sales?'Customer':'Vendor'}<select required value={partyId} onChange={e=>setPartyId(e.target.value)}><option value="">Select</option>{party.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="db-field">Document number<input required value={number} onChange={e=>setNumber(e.target.value)} maxLength={50}/></label><label className="db-field">Document date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label></div>
 <div className="trade-items"><div className="panel-title"><b>Items</b><button type="button" className="db-refresh" onClick={()=>setItems(x=>[...x,{productId:products[0]?.id||'',quantity:'1',price:'0'}])}>+ Add item</button></div>
 {items.map((x,i)=><div className="trade-item" key={i}><label className="db-field">Product<select required value={x.productId} onChange={e=>{const p=products.find(z=>z.id===e.target.value);change(i,'productId',e.target.value);change(i,'price',String(sales?(p?.selling_price||0):0))}}><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="db-field">Quantity<input type="number" min="0.0001" step="any" required value={x.quantity} onChange={e=>change(i,'quantity',e.target.value)}/></label><label className="db-field">{sales?'Unit price':'Unit cost'} ₹<input type="number" min="0" step="0.01" required value={x.price} onChange={e=>change(i,'price',e.target.value)}/></label>{items.length>1&&<button type="button" className="db-refresh" onClick={()=>setItems(x=>x.filter((_,n)=>n!==i))}>Remove</button>}</div>)}</div>
 <div className="trade-total"><span>Total (GST not calculated)</span><b>₹{total.toFixed(2)}</b></div>{error&&<p className="db-error">{error}</p>}{notice&&<p className="db-success">{notice}</p>}<button className="db-save" disabled={busy||!fy||!party.length||!products.length}>Save draft</button></form>
 <div className="panel db-list"><div className="panel-title"><b>{sales?'Invoice register':'Purchase register'}</b><button className="db-refresh" onClick={()=>load()}>Refresh</button></div><div className="db-table-wrap"><table><thead><tr><th>Number</th><th>Party</th><th>Date</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>{docs.map(d=><tr key={d.id}><td>{sales?d.invoice_number:d.bill_number}</td><td>{sales?d.customer_name:d.vendor_name}</td><td>{sales?d.invoice_date:d.bill_date}</td><td>₹{Number(d.total_amount).toFixed(2)}</td><td>{d.status}</td><td>{d.status==='draft'?<button className="db-refresh" disabled={busy} onClick={()=>post(d.id)}>Post</button>:d.status==='posted'?<button className="db-refresh" disabled={busy} onClick={()=>reverse(d.id)}>Reverse</button>:'—'}</td></tr>)}</tbody></table></div></div>
 <p className="db-muted">Posted documents create permanent stock movements. Reversals add compensating entries. GST calculation and e-invoice are not included yet.</p></div>
}
function ReceivablesAgingWorkspace(){
 const api=typeof window!=='undefined'?window.bizora?.database:null
 const [invoices,setInvoices]=useState([]),[asOf,setAsOf]=useState(new Date().toISOString().slice(0,10)),[loading,setLoading]=useState(true),[error,setError]=useState('')
 async function load(){if(!api){setLoading(false);return}setLoading(true);setError('');try{setInvoices(await api.listSalesInvoices())}catch(e){setError(e.message||'Could not load invoices.')}finally{setLoading(false)}}
 useEffect(()=>{load()},[])
 const buckets={current:0,days_1_30:0,days_31_60:0,days_61_90:0,days_over_90:0}
 let outstandingTotal=0
 for(const invoice of invoices){
  const total=Math.round(Number(invoice.total_amount||0)*100),received=Math.round(Number(invoice.received_amount||0)*100),outstanding=Math.max(0,total-received)
  if(!Number.isFinite(outstanding)||outstanding===0)continue
  const due=invoice.due_date||invoice.invoice_date
  if(!due)continue
  const days=Math.floor((Date.parse(asOf+'T00:00:00Z')-Date.parse(due+'T00:00:00Z'))/86400000)
  const key=days<=0?'current':days<=30?'days_1_30':days<=60?'days_31_60':days<=90?'days_61_90':'days_over_90'
  buckets[key]+=outstanding;outstandingTotal+=outstanding
 }
 const money=v=>'₹'+(v/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})
 if(!api)return <div className="panel db-empty"><LockKeyhole/><b>Open BIZORA desktop app</b><p>Receivables report reads local invoice records.</p></div>
 return <div className="db-workspace"><div className="db-heading"><div><h2>Receivables Aging</h2><p>Outstanding invoice balances grouped by due date. As-of date can be changed.</p></div><span className="db-count">{invoices.length} invoices</span></div>
 <div className="panel db-form"><div className="db-fields"><label className="db-field">Report as of<input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)}/></label></div><button type="button" className="db-refresh" onClick={load}>Refresh invoices</button>{error&&<p className="db-error">{error}</p>}</div>
 <div className="stats aging-stats"><div><small>Total outstanding</small><b>{money(outstandingTotal)}</b><em>Based on recorded receipts</em></div><div><small>Current / not overdue</small><b>{money(buckets.current)}</b></div><div><small>1–30 days</small><b>{money(buckets.days_1_30)}</b></div><div><small>31–60 days</small><b>{money(buckets.days_31_60)}</b></div></div>
 <div className="panel db-list"><div className="panel-title"><b>Aging buckets</b><span>{loading?'Loading…':'Live local calculation'}</span></div><div className="db-table-wrap"><table><thead><tr><th>Age</th><th>Outstanding</th></tr></thead><tbody>{[['Current',buckets.current],['1–30 days',buckets.days_1_30],['31–60 days',buckets.days_31_60],['61–90 days',buckets.days_61_90],['Over 90 days',buckets.days_over_90]].map(([label,value])=><tr key={label}><td>{label}</td><td>{money(value)}</td></tr>)}</tbody></table></div></div>
 <p className="db-muted">Note: payment receipts are not yet saved against invoices in the database. Until that integration is complete, this report treats received amount as zero unless a record already contains it. Verify balances before using this report for collection decisions.</p></div>
}

function WarehouseWorkspace(){
 const api=typeof window!=='undefined'?window.bizora?.database:null
 const [stock,setStock]=useState([]),[moves,setMoves]=useState([])
 async function load(){if(!api)return;const p=await api.listProducts();setStock(await Promise.all(p.map(x=>api.getProductStock(x.id))));setMoves(await api.listStockMovements(null,200))}
 useEffect(()=>{load().catch(()=>{})},[])
 if(!api)return <div className="panel db-empty"><LockKeyhole/><b>Open BIZORA desktop app</b></div>
 return <div className="db-workspace"><div className="db-heading"><div><h2>Warehouse &amp; Stock Ledger</h2><p>Opening stock plus posted purchase and sales movements.</p></div><span className="db-count">{stock.length} products</span></div><div className="panel db-list"><div className="panel-title"><b>Current stock</b><button className="db-refresh" onClick={()=>load()}>Refresh</button></div><div className="db-table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Balance</th></tr></thead><tbody>{stock.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.sku||'—'}</td><td>{x.current_stock}</td></tr>)}</tbody></table></div></div><div className="panel db-list"><div className="panel-title"><b>Movement history</b><span>{moves.length} entries</span></div><div className="db-table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty change</th></tr></thead><tbody>{moves.map(m=><tr key={m.id}><td>{m.created_at.slice(0,10)}</td><td>{m.product_name}</td><td>{m.movement_type}</td><td>{m.quantity_delta>0?'+':''}{m.quantity_delta}</td></tr>)}</tbody></table></div></div></div>
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

function FinancialYearTaxWorkspace(){
 const api=typeof window!=='undefined'?window.bizora?.database:null
 const now=new Date(), startYear=now.getMonth()>=3?now.getFullYear():now.getFullYear()-1
 const [years,setYears]=useState([]),[gstins,setGstins]=useState([]),[settings,setSettings]=useState({gst_enabled:0,default_tax_mode:'none',place_of_supply_state_code:'',default_gstin_id:''})
 const [label,setLabel]=useState(startYear+'-'+String(startYear+1).slice(-2)),[startDate,setStartDate]=useState(startYear+'-04-01'),[endDate,setEndDate]=useState((startYear+1)+'-03-31')
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 async function load(){if(!api)return;const values=await Promise.all([api.listFinancialYears(),api.listCompanyGstins(),api.getCompanyTaxSettings()]);setYears(values[0]);setGstins(values[1]);setSettings({...values[2],place_of_supply_state_code:values[2].place_of_supply_state_code||'',default_gstin_id:values[2].default_gstin_id||''})}
 useEffect(()=>{load().catch(e=>setError(e.message||'Could not load financial year settings.'))},[])
 async function createYear(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await api.createFinancialYear({label,startDate,endDate});setNotice('Financial year saved. Select it as active when you are ready.');await load()}catch(e){setError(e.message||'Could not create financial year.')}finally{setBusy(false)}}
 async function activate(id){setBusy(true);setError('');setNotice('');try{await api.setActiveFinancialYear(id);await load();setNotice('Active financial year changed.')}catch(e){setError(e.message||'Could not activate financial year.')}finally{setBusy(false)}}
 async function saveTax(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await api.saveCompanyTaxSettings({gstEnabled:!!settings.gst_enabled,defaultTaxMode:settings.default_tax_mode,placeOfSupplyStateCode:settings.place_of_supply_state_code,defaultGstinId:settings.default_gstin_id});await load();setNotice('Company tax settings saved locally.')}catch(e){setError(e.message||'Could not save tax settings.')}finally{setBusy(false)}}
 if(!api)return <div className="panel db-empty"><LockKeyhole/><b>Open the BIZORA Windows desktop app</b><p>Financial year and tax settings are stored locally for each company.</p></div>
 return <div className="db-workspace">
  <div className="db-heading"><div><h2>Financial Year &amp; GST Settings</h2><p>Configure accounting periods and tax defaults separately for the active company.</p></div><span className="db-count">Company-wise</span></div>
  <div className="panel db-list"><div className="panel-title"><b>Financial years</b><span>{years.length} configured</span></div>{years.length===0?<p className="db-muted">No financial year configured. Add your first accounting period below.</p>:<div className="company-choice">{years.map(y=><button type="button" key={y.id} className={y.status==='active'?'company-choice-active':''} disabled={busy||y.status==='active'||y.status==='closed'} onClick={()=>activate(y.id)}><b>{y.label}</b><small>{y.start_date} to {y.end_date}</small><em>{y.status==='active'?'ACTIVE':y.status==='closed'?'CLOSED':'Set active'}</em></button>)}</div>}</div>
  <div className="panels company-panels">
   <form className="panel db-form" onSubmit={createYear}><div className="panel-title"><b>Add financial year</b><span>India FY suggestion: April–March</span></div><div className="db-fields"><label className="db-field">Financial year label<input required maxLength={40} value={label} onChange={e=>setLabel(e.target.value)} placeholder="2026-27"/></label><label className="db-field">Start date<input required type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label className="db-field">End date<input required type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></div><button className="db-save" disabled={busy}>Save financial year</button></form>
   <form className="panel db-form" onSubmit={saveTax}><div className="panel-title"><b>GST &amp; tax defaults</b><span>Not a tax calculation engine</span></div><div className="db-fields">
    <label className="db-field">GST registration status<select value={String(settings.gst_enabled)} onChange={e=>setSettings(v=>({...v,gst_enabled:Number(e.target.value)}))}><option value="0">GST not enabled</option><option value="1">GST enabled</option></select></label>
    <label className="db-field">Default GSTIN<select value={settings.default_gstin_id} onChange={e=>setSettings(v=>({...v,default_gstin_id:e.target.value}))}><option value="">Select GSTIN</option>{gstins.filter(g=>g.status==='active').map(g=><option key={g.id} value={g.id}>{g.gstin}{g.label?' · '+g.label:''}</option>)}</select></label>
    <label className="db-field">Default tax mode<select value={settings.default_tax_mode} onChange={e=>setSettings(v=>({...v,default_tax_mode:e.target.value}))}><option value="none">No tax default</option><option value="exclusive">Tax exclusive</option><option value="inclusive">Tax inclusive</option></select></label>
    <label className="db-field">Place of supply state code<input maxLength={2} inputMode="numeric" value={settings.place_of_supply_state_code} onChange={e=>setSettings(v=>({...v,place_of_supply_state_code:e.target.value.replace(/[^0-9]/g,'')}))} placeholder="08"/></label>
   </div><button className="db-save" disabled={busy}>Save GST settings</button></form>
  </div>
  {error&&<p className="db-error">{error}</p>}{notice&&<p className="db-success">{notice}</p>}
  <div className="panel db-list"><b>Important</b><p className="db-muted">Financial years cannot overlap within the same company. Creating a year does not activate it automatically. GSTIN format is checked only; registration status is not verified with the GST portal. These settings do not yet calculate GST or post invoices.</p></div>
 </div>
}

function BackupWorkspace(){
 const api=typeof window!=='undefined'?window.bizora?.database:null
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 async function createBackup(){if(!api)return;setBusy(true);setError('');setNotice('');try{const result=await api.createBackup();if(!result.cancelled)setNotice('Encrypted backup saved: '+result.filePath)}catch(e){setError(e.message||'Could not create backup.')}finally{setBusy(false)}}
 async function restoreBackup(){if(!api)return;setBusy(true);setError('');setNotice('');try{const result=await api.restoreBackup();if(!result.cancelled){setNotice('Backup restored successfully. Refreshing workspace…');window.location.reload()}}catch(e){setError(e.message||'Could not restore backup.')}finally{setBusy(false)}}
 if(!api)return <div className="panel db-empty"><LockKeyhole/><b>Open the BIZORA Windows desktop app</b><p>Backup and restore require the desktop app.</p></div>
 return <div className="db-workspace"><div className="db-heading"><div><h2>Backup &amp; Restore</h2><p>Protect your local business database with an encrypted backup file.</p></div><span className="db-count">Encrypted</span></div><div className="panels company-panels"><div className="panel db-form backup-card"><Database size={24}/><h3>Create encrypted backup</h3><p>Save an encrypted snapshot to a location you choose. Keep a copy on a separate secure drive.</p><button className="db-save" disabled={busy} onClick={createBackup}>{busy?'Please wait…':'Create backup file'}</button></div><div className="panel db-form backup-card"><LockKeyhole size={24}/><h3>Restore from backup</h3><p>Choose a BIZORA backup. The app validates encryption, database integrity and version before replacing current local data.</p><button className="db-save backup-restore" disabled={busy} onClick={restoreBackup}>{busy?'Please wait…':'Choose backup to restore'}</button></div></div>{error&&<p className="db-error">{error}</p>}{notice&&<p className="db-success">{notice}</p>}<div className="panel db-list"><b>Important safety notes</b><ul className="backup-notes"><li>Restore replaces current local data after a confirmation prompt.</li><li>Create a fresh backup before restoring an older file.</li><li>Backups use Windows secure storage and may only restore under the same Windows user/device security context.</li><li>Keep multiple backup copies. This is not cloud sync or automatic off-site backup.</li></ul></div></div>
}

export default function App(){
 const [active,setActive]=useState('Overview'),[dark,setDark]=useState(false)
 return <div className={dark?'app dark':'app'}><aside className="sidebar"><div className="logo"><b>B</b><span>BIZO<span>RA</span><small>BUSINESS WORKSPACE</small></span></div><div className="company"><Building2 size={17}/><span>My Business<small>Basic Plan</small></span><ChevronRight size={15}/></div><small className="nav-label">WORKSPACE</small>{nav.map(([name,Icon])=><button className={active===name?'selected':''} onClick={()=>setActive(name)} key={name}><Icon size={17}/>{name}</button>)}<div className="side-bottom"><div className="upgrade"><LockKeyhole size={18}/><b>Premium features</b><p>Unlock advanced tools when your plan is activated.</p><button onClick={()=>setActive('Upgrade')}>Talk to Specialist</button></div><button onClick={()=>setDark(!dark)}><Moon size={17}/> Switch appearance {dark?<Sun size={15}/>:null}</button><div className="user"><div>AB</div><span>Business Owner<small>Basic workspace</small></span></div></div></aside><main className="main"><header><div><span className="crumb">Workspace / </span>{active}</div><div className="header-right"><span className="offline"><i/> Offline-ready design</span><button className="help"><CircleHelp size={17}/></button></div></header><section className="content"><div className="welcome"><div><small>YOUR BUSINESS, AT A GLANCE</small><h1>{active==='Overview'?'Good day.':active}</h1><p>This is your BIZORA desktop preview. Business features will be added in phases.</p></div><span className="date">PROJECT 521 · PREVIEW</span></div>{active==='Overview'?<><div className="stats"><div><small>Total sales</small><b>₹ —</b><em>No transactions yet</em></div><div><small>Outstanding</small><b>₹ —</b><em>Awaiting data</em></div><div><small>Products</small><b>—</b><em>Not configured</em></div><div><small>Low stock items</small><b>—</b><em>Not configured</em></div></div><div className="panels"><article className="panel chart-panel"><div className="panel-title"><b>Business activity</b><span>Will appear after setup</span></div><div className="empty-chart"><BarChart3 size={35}/><b>Your business insights will appear here</b><p>Add your first invoice or purchase to get started.</p></div></article><article className="panel"><div className="panel-title"><b>Quick actions</b><span>Basic workspace</span></div>{['Create invoice','Add a product','Add a customer','Record an expense'].map((x,i)=><button className="quick" key={x} onClick={()=>setActive(x==='Add a product'?'Products & Stock':x==='Add a customer'?'Customers':x)}><span>{['＋','▦','♙','₹'][i]}</span>{x}<ChevronRight size={15}/></button>)}</article></div><div className="locked"><div><LockKeyhole/><span><b>Premium systems are visible, but locked</b><small>Advanced GST, multi-company, POS, barcode and advanced reports.</small></span></div><button onClick={()=>setActive('Upgrade')}>View upgrade options <ChevronRight size={15}/></button></div></>:active==='Invoices'||active==='Sales'||active==='Create invoice'?<TradeWorkspace type="sales"/>:active==='Purchases'?<TradeWorkspace type="purchase"/>:active==='Reports'?<ReceivablesAgingWorkspace/>:active==='Warehouse'?<WarehouseWorkspace/>:active==='Customers'?<DataWorkspace type="customers"/>:active==='Products & Stock'?<DataWorkspace type="products"/>:active==='Company Settings'?<CompanyWorkspace/>:active==='Financial Year & GST'?<FinancialYearTaxWorkspace/>:active==='Data Backup'?<BackupWorkspace/>:<div className="panel placeholder"><LockKeyhole size={28}/><h2>{active}</h2><p>This module is part of the BIZORA build roadmap. It is not active in this starter preview.</p><button onClick={()=>setActive('Overview')}>Back to overview</button></div>}<footer>BIZORA · Developed & Maintained by FIXBYTE INDIA</footer></section></main></div>
}
