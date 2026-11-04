import React, { useState } from 'react'
import AdminPanel from './AdminPanel'
import { ArrowUpRight, BarChart3, Boxes, Building2, Check, ChevronRight, FileText, Menu, Moon, ShieldCheck, Sun, Wallet, X } from 'lucide-react'

const features = [
  { icon: FileText, title: 'Billing & Invoices', desc: 'Create, manage and share professional invoices, credit notes and sales documents.' },
  { icon: Boxes, title: 'Inventory & Warehouse', desc: 'Track products, stock movement, warehouses and inventory timelines.' },
  { icon: Wallet, title: 'Purchases & Expenses', desc: 'Organise purchase orders, debit notes, expenses and indirect income.' },
  { icon: BarChart3, title: 'Reports & Insights', desc: 'Understand sales, purchases, outstanding balances and business performance.' },
  { icon: Building2, title: 'Multi-company ready', desc: 'A planned workspace for multiple companies and GST registrations.' },
  { icon: ShieldCheck, title: 'Offline-first desktop', desc: 'Designed to keep core desktop workflows available when internet is unavailable.' },
]
function WebsiteApp() {
  const [dark, setDark] = useState(false)
  const [menu, setMenu] = useState(false)
  const [form, setForm] = useState({ name:'', mobile:'', business:'', plan:'Premium', message:'' })
  const [sent, setSent] = useState(false)
  const whatsapp = import.meta.env.VITE_SUPPORT_WHATSAPP || '7357204736'
  const submit = (e) => {
    e.preventDefault()
    const id = 'BIZ-' + Date.now().toString().slice(-8)
    const msg = `TRADEXO enquiry ${id}%0AName: ${encodeURIComponent(form.name)}%0AMobile: ${encodeURIComponent(form.mobile)}%0ABusiness: ${encodeURIComponent(form.business)}%0APlan: ${encodeURIComponent(form.plan)}%0AMessage: ${encodeURIComponent(form.message)}`
    window.open(`https://wa.me/91${whatsapp}?text=${msg}`, '_blank', 'noopener,noreferrer')
    setSent(true)
  }
  return <div className={dark ? 'site dark' : 'site'}>
    <header className="nav wrap">
      <a className="brand" href="#"><span className="brand-mark">B</span><span>BIZO<span className="violet">RA</span><small>BY FIXBYTE INDIA</small></span></a>
      <button className="mobile-menu" onClick={()=>setMenu(!menu)} aria-label="Toggle menu">{menu?<X/>:<Menu/>}</button>
      <nav className={menu?'open':''}><a href="#features" onClick={()=>setMenu(false)}>Features</a><a href="#plans" onClick={()=>setMenu(false)}>Plans</a><a href="#about" onClick={()=>setMenu(false)}>About</a><a href="#contact" className="nav-cta" onClick={()=>setMenu(false)}>Talk to Specialist <ArrowUpRight size={16}/></a></nav>
      <button className="theme" onClick={()=>setDark(!dark)} aria-label="Toggle theme">{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
    </header>
    <main>
      <section className="hero wrap">
        <div className="hero-copy"><div className="eyebrow"><span className="pulse"/> BUSINESS MANAGEMENT, REIMAGINED</div>
          <h1>One business.<br/><span className="gradient">One powerful system.</span></h1>
          <p className="lead">Bring billing, inventory, purchases and business insights together. Meet a calmer, clearer way to run your business.</p>
          <div className="hero-actions"><a className="button primary" href="#contact">Talk to a Specialist <ArrowUpRight size={17}/></a><a className="button secondary" href="#features">Explore features <ChevronRight size={17}/></a></div>
          <div className="trust"><span><Check size={15}/> Windows desktop planned</span><span><Check size={15}/> Offline-first approach</span><span><Check size={15}/> Built by FIXBYTE INDIA</span></div>
        </div>
        <div className="visual"><div className="orb orb-one"/><div className="orb orb-two"/><div className="dash-card">
          <div className="dash-top"><div><span className="tiny-label">TRADEXO WORKSPACE</span><h3>Business overview</h3></div><span className="live">● Preview</span></div>
          <div className="metric-grid"><div className="metric"><small>Sales overview</small><strong>₹ 2,48,500</strong><em>Illustrative data</em></div><div className="metric"><small>Stock health</small><strong>94.8%</strong><em>Illustrative data</em></div></div>
          <div className="chart"><div className="chart-label"><b>Business activity</b><small>Sample visual</small></div><div className="bars">{[34,52,42,70,57,84,64,94,72,80,59,100].map((h,i)=><i key={i} style={{height:h+'%'}}/>)}</div></div>
          <div className="dash-bottom"><span><i className="dot green"/> Billing</span><span><i className="dot purple"/> Inventory</span><span><i className="dot orange"/> Reports</span></div>
        </div></div>
      </section>
      <section className="strip"><div className="wrap strip-inner"><span>BUILT FOR EVERYDAY BUSINESS</span><b>Billing</b><b>Inventory</b><b>Purchases</b><b>GST workflows</b><b>Insights</b></div></section>
      <section className="section wrap" id="features"><div className="section-head"><div className="eyebrow">ONE CONNECTED WORKSPACE</div><h2>Everything important.<br/><span className="muted">In one place.</span></h2><p>TRADEXO is being developed as a modular business management platform. Explore the planned capabilities below.</p></div>
        <div className="feature-grid">{features.map(({icon:Icon,title,desc})=><article className="feature" key={title}><div className="feature-icon"><Icon size={21}/></div><h3>{title}</h3><p>{desc}</p><span className="feature-arrow"><ArrowUpRight size={17}/></span></article>)}</div>
      </section>
      <section className="plan-section" id="plans"><div className="wrap plan-layout"><div><div className="eyebrow">SIMPLE START. ROOM TO GROW.</div><h2>Start free.<br/><span className="gradient">Grow with Premium.</span></h2><p>Begin with the Basic plan. Premium capabilities stay visible in the software and unlock only after specialist confirmation and admin activation.</p></div>
        <div className="plans"><article className="plan"><span className="plan-tag">GET STARTED</span><h3>Basic</h3><div className="price">Free</div><p>Core tools for getting started.</p><ul><li><Check/> Basic billing</li><li><Check/> Products & customers</li><li><Check/> Basic stock & reports</li><li><Check/> Data export & backup</li></ul><a href="#contact" className="button secondary full">Get started <ArrowUpRight size={16}/></a></article>
        <article className="plan premium"><span className="plan-tag">FOR GROWING BUSINESSES</span><h3>Premium</h3><div className="price">₹1,499 <small>/ year*</small></div><p>Advanced capabilities for growing teams.</p><ul><li><Check/> Advanced billing & GST workflows</li><li><Check/> Multi-company / GSTIN tools</li><li><Check/> Warehouse, POS & barcode</li><li><Check/> Advanced reports & roles</li></ul><a href="#contact" className="button primary full">Talk to Specialist <ArrowUpRight size={16}/></a><small className="disclaimer">*Proposed launch price; subject to confirmation.</small></article></div>
      </div></section>
      <section className="section wrap about" id="about"><div className="about-card"><div className="eyebrow">MADE FOR BUSINESS OWNERS</div><h2>Clarity in your workday.<br/><span className="muted">Control in your hands.</span></h2><p>TRADEXO is a FIXBYTE INDIA product focused on bringing everyday business operations into one dependable workspace. The first release is planned for Windows 10 and 11.</p><div className="about-points"><span><ShieldCheck/> Designed with data safety in mind</span><span><Check/> Basic workflows designed for offline use</span></div></div></section>
      <section className="contact-section" id="contact"><div className="wrap contact-layout"><div><div className="eyebrow">LET'S TALK BUSINESS</div><h2>Need the right setup<br/>for your business?</h2><p>Tell us a little about your business. Our specialist can help you understand the plans and next steps.</p><div className="contact-info"><b>WhatsApp / Call</b><a href={`https://wa.me/91${whatsapp}`} target="_blank" rel="noreferrer">+91 {whatsapp} <ArrowUpRight size={15}/></a><small>Available 10:00 AM – 8:00 PM</small></div></div>
        <form className="contact-form" onSubmit={submit}><h3>Talk to a Specialist</h3><p>Submitting opens a WhatsApp draft. You must press Send in WhatsApp.</p><label>Your name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Enter your name"/></label><label>Mobile number<input required inputMode="tel" pattern="[0-9+ ()-]{8,18}" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} placeholder="Your contact number"/></label><label>Business type<input required value={form.business} onChange={e=>setForm({...form,business:e.target.value})} placeholder="Retail, distribution, services..."/></label><label>Interested plan<select value={form.plan} onChange={e=>setForm({...form,plan:e.target.value})}><option>Basic</option><option>Premium</option></select></label><label>Message (optional)<textarea rows="3" value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="What would you like to manage?"/></label><button className="button primary full" type="submit">Continue on WhatsApp <ArrowUpRight size={16}/></button>{sent&&<small className="success">WhatsApp draft opened. Please review and press Send.</small>}</form>
      </div></section>
    </main>
    <footer><div className="wrap footer-inner"><a className="brand" href="#"><span className="brand-mark">B</span><span>BIZO<span className="violet">RA</span><small>BY FIXBYTE INDIA</small></span></a><span>© {new Date().getFullYear()} TRADEXO. All rights reserved.</span><b>Developed & Maintained by FIXBYTE INDIA</b></div></footer>
  </div>
}
export default function App() { return ['/admin','/admin/'].includes(window.location.pathname) ? <AdminPanel /> : <WebsiteApp /> }
