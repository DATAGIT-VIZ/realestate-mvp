'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  User, Users, Download, RefreshCw, Loader2,
  TrendingUp, Target, Trophy, ChevronRight,
  Lock, FileText, Activity, MapPin, BarChart2,
  Mail, Printer, LayoutGrid, GitBranch, Calendar,
} from 'lucide-react'
import { getPlan, getRole } from '@/lib/plan'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = '#F8FAFC'
const PANEL   = '#FFFFFF'
const BORDER  = '#E2E8F0'
const TEXT    = '#0F172A'
const MUTED   = '#64748B'
const LABEL   = '#94A3B8'
const BLUE    = '#a000c8'
const BLUE_D  = 'rgba(160,0,200,0.07)'
const GREEN   = '#059669'
const AMBER   = '#be2ed6'
const AMBER_D = 'rgba(190,46,214,0.07)'
const VIOLET  = '#a000c8'
const VIOLET_D= 'rgba(160,0,200,0.07)'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number) {
  if (!n) return '₹0'
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}
function pct(a: number, b: number) { return b ? Math.round((a / b) * 100) : 0 }

const RANGES = [
  { id: '7d',  label: 'This week' },
  { id: '30d', label: 'This month' },
  { id: '90d', label: 'Last 3 months' },
  { id: 'all', label: 'All time' },
]
function sinceDate(r: string): Date {
  const d = new Date()
  if (r === '7d')  { d.setDate(d.getDate() - 7);  return d }
  if (r === '30d') { d.setDate(d.getDate() - 30); return d }
  if (r === '90d') { d.setDate(d.getDate() - 90); return d }
  return new Date('2020-01-01')
}
function rangeLabel(r: string) {
  const now = new Date()
  if (r === '7d')  return `${new Date(Date.now()-6*86400000).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${now.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`
  if (r === '30d') return `${new Date(Date.now()-29*86400000).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${now.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`
  if (r === '90d') return `${new Date(Date.now()-89*86400000).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${now.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`
  return 'All time'
}

// ─── Print HTML generator ─────────────────────────────────────────────────────
type ReportType = 'productivity' | 'by-source' | 'seasonal' | 'pipeline'

function buildPrintHTML(
  agentName: string, agentRole: string, range: string,
  reportType: ReportType, data: ReportData, isDemo: boolean
): string {
  const since = sinceDate(range)
  const leads  = data.leads.filter(l => !l.createdAt || new Date(l.createdAt) >= since)
  const acts   = data.activities.filter(a => new Date(a.createdAt) >= since)
  const deals  = data.deals
  const today  = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const period = rangeLabel(range)

  const fmtH = (n: number) => {
    if (!n) return '₹0'
    if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
    if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
    return `₹${n.toLocaleString('en-IN')}`
  }
  const pctH = (a: number, b: number) => b ? Math.round((a / b) * 100) : 0
  const bar  = (p: number, color = '#a000c8') =>
    `<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:7px;background:#E2E8F0;border-radius:4px"><div style="width:${p}%;height:100%;background:${color};border-radius:4px;print-color-adjust:exact;-webkit-print-color-adjust:exact"></div></div><span style="font-size:11px;font-weight:700;color:${color};min-width:32px">${p}%</span></div>`

  const STAGE_LABEL: Record<string,string> = {new:'New',site_visit:'Site Visit',negotiation:'Negotiation',token_paid:'Token Paid',won:'Won',lost:'Lost'}
  const STAGE_COLOR: Record<string,string> = {new:'#94A3B8',site_visit:'#a000c8',negotiation:'#be2ed6',token_paid:'#a000c8',won:'#059669',lost:'#EF4444'}

  const titleLabel: Record<string, string> = {
    productivity: 'Productivity Report',
    'by-source':  'Lead Source & Portal Report',
    seasonal:     'Seasonal Performance Report',
    pipeline:     'Pipeline Report',
  }

  const CSS = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,Arial,Helvetica,sans-serif;color:#0F172A;background:#fff;font-size:13px}
    .page{max-width:900px;margin:0 auto}
    /* Header */
    .rpt-header{background:#4c00b0;color:#fff;padding:22px 32px;display:flex;justify-content:space-between;align-items:center;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .rpt-brand{font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;opacity:.65;margin-bottom:3px}
    .rpt-title{font-size:22px;font-weight:800;letter-spacing:-.02em}
    .rpt-gen{text-align:right;font-size:11px;opacity:.7;line-height:1.5}
    /* Subheader */
    .rpt-sub{background:#F1F5F9;padding:12px 32px;border-bottom:3px solid #a000c8;display:flex;justify-content:space-between;align-items:center;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .rpt-agent{font-size:16px;font-weight:800;color:#0F172A}
    .rpt-period{font-size:12px;color:#64748B;margin-top:2px}
    .rpt-conf{font-size:9px;font-weight:800;color:#EF4444;text-transform:uppercase;letter-spacing:.08em;border:1.5px solid #EF4444;padding:2px 8px;border-radius:5px}
    .demo-badge{font-size:9px;font-weight:800;background:rgba(190,46,214,0.07);color:#be2ed6;border:1px solid rgba(190,46,214,.3);border-radius:12px;padding:2px 9px;text-transform:uppercase;letter-spacing:.06em;margin-left:10px}
    /* Content */
    .rpt-body{padding:24px 32px}
    /* Section */
    .sec{margin-bottom:24px}
    .sec-title{font-size:10px;font-weight:800;color:#a000c8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;padding-bottom:7px;border-bottom:2px solid rgba(160,0,200,0.07);display:flex;align-items:center;gap:6px}
    .sec-title::before{content:'';display:inline-block;width:3px;height:12px;background:#a000c8;border-radius:2px;flex-shrink:0}
    /* KPI grid */
    .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}
    .kpi-box{border:1px solid #E2E8F0;border-radius:10px;padding:14px 14px 12px;position:relative;overflow:hidden;background:#fff}
    .kpi-accent{position:absolute;top:0;left:0;right:0;height:3px;border-radius:0}
    .kpi-label{font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px}
    .kpi-val{font-size:24px;font-weight:800;color:#0F172A;letter-spacing:-.02em;line-height:1}
    .kpi-sub{font-size:10px;color:#94A3B8;margin-top:4px}
    /* Banner */
    .banner{background:rgba(160,0,200,0.07);border:1px solid rgba(160,0,200,0.2);border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .banner-label{font-size:10px;font-weight:700;color:#a000c8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
    .banner-val{font-size:22px;font-weight:800;color:#0F172A}
    .banner-note{font-size:11px;color:#64748B}
    /* Tables */
    .tbl{width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0}
    .tbl thead tr{background:#a000c8;color:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .tbl thead th{padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;text-align:left}
    .tbl tbody tr:nth-child(even){background:#F8FAFC;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .tbl tbody td{padding:10px 12px;font-size:12px;border-bottom:1px solid #F1F5F9;vertical-align:middle}
    .tbl tbody tr:last-child td{border-bottom:none}
    /* Two-col */
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    /* Stage dots */
    .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;flex-shrink:0;vertical-align:middle;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    /* Highlight box */
    .highlight{background:rgba(160,0,200,0.07);border:1px solid rgba(160,0,200,0.2);border-radius:10px;padding:14px 16px;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .highlight.amber{background:rgba(190,46,214,0.07);border-color:rgba(190,46,214,.25)}
    .highlight.green{background:#ECFDF5;border-color:rgba(5,150,105,.2)}
    .hl-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
    .hl-val{font-size:18px;font-weight:800;color:#0F172A}
    .hl-sub{font-size:11px;color:#64748B;margin-top:2px}
    /* Near close row */
    .nc-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(160,0,200,.1)}
    .nc-row:last-child{border-bottom:none}
    /* Footer */
    .rpt-footer{padding:12px 32px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;margin-top:8px}
    .footer-txt{font-size:10px;color:#94A3B8}
    @media print{
      body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
      @page{margin:.8cm 1cm}
      .rpt-header,.rpt-sub,.tbl thead tr,.banner,.kpi-accent,.highlight{print-color-adjust:exact;-webkit-print-color-adjust:exact}
      .sec{break-inside:avoid}
      .kpi-box{break-inside:avoid}
    }
  `

  // ── Shared header/footer HTML ──────────────────────────────────────────────
  const header = `
    <div class="rpt-header">
      <div>
        <div class="rpt-brand">RealEdge CRM</div>
        <div class="rpt-title">${titleLabel[reportType]}</div>
      </div>
      <div class="rpt-gen">
        <div>Generated</div>
        <div style="font-weight:700;color:#fff;font-size:13px">${today}</div>
        ${isDemo ? '<div style="margin-top:4px"><span style="font-size:9px;background:rgba(251,191,36,.2);color:rgba(190,46,214,0.25);border:1px solid rgba(251,191,36,.3);border-radius:10px;padding:1px 8px;text-transform:uppercase;letter-spacing:.06em">Sample Data</span></div>' : ''}
      </div>
    </div>
    <div class="rpt-sub">
      <div>
        <div class="rpt-agent">${agentName}${agentRole ? ` <span style="font-size:11px;font-weight:500;color:#64748B;text-transform:capitalize">(${agentRole.replace(/_/g,' ')})</span>` : ''}</div>
        <div class="rpt-period">Period: ${period}</div>
      </div>
      <div class="rpt-conf">Confidential</div>
    </div>`

  const footer = `
    <div class="rpt-footer">
      <span class="footer-txt">© ${new Date().getFullYear()} RealEdge CRM · Powered by VyaPulse</span>
      <span class="footer-txt">Confidential — For internal use only</span>
    </div>`

  // ── Build body based on report type ───────────────────────────────────────
  let body = ''

  if (reportType === 'productivity') {
    const totalLeads  = leads.length
    const hotLeads    = leads.filter(l => (l.intentScore??0) >= 70).length
    const calls       = acts.filter(a => a.type?.toLowerCase().includes('call')).length
    const connected   = acts.filter(a => a.outcome?.toLowerCase().includes('connect')).length
    const siteVisits  = acts.filter(a => a.type === 'site_visit').length
    const wonDeals    = deals.filter(d => d.stage === 'won').length
    const closedDeals = deals.filter(d => ['won','lost'].includes(d.stage)).length
    const winRate     = pctH(wonDeals, closedDeals)
    const pipelineVal = deals.filter(d => !['won','lost'].includes(d.stage)).reduce((s,d)=>s+(d.deal_value??0),0)
    const wonVal      = deals.filter(d => d.stage==='won').reduce((s,d)=>s+(d.deal_value??0),0)
    const responseRate= pctH(leads.filter(l=>acts.some(a=>a.personId===l.id)).length, totalLeads)

    const srcMap: Record<string,number> = {}
    for (const l of leads) { const s=l.sourcePortal??'Direct'; srcMap[s]=(srcMap[s]??0)+1 }
    const sources = Object.entries(srcMap).sort(([,a],[,b])=>b-a)
    const srcTotal = sources.reduce((s,[,v])=>s+v,0)

    const stageMap: Record<string,number> = {}
    for (const d of deals.filter(x=>x.stage!=='lost')) { stageMap[d.stage]=(stageMap[d.stage]??0)+1 }
    const stageRows = Object.entries(stageMap).sort(([,a],[,b])=>b-a)

    const actMap: Record<string,number> = {}
    for (const a of acts) { const t=a.type??'Other'; actMap[t]=(actMap[t]??0)+1 }
    const actRows = Object.entries(actMap).sort(([,a],[,b])=>b-a)

    const cityMap: Record<string,number> = {}
    for (const l of leads) { const c=l.city??'Unknown'; cityMap[c]=(cityMap[c]??0)+1 }
    const cities = Object.entries(cityMap).sort(([,a],[,b])=>b-a).slice(0,6)

    body = `
      <div class="sec">
        <div class="sec-title">Performance Snapshot</div>
        <div class="kpi-grid">
          <div class="kpi-box"><div class="kpi-accent" style="background:#a000c8"></div><div class="kpi-label">Leads Added</div><div class="kpi-val">${totalLeads}</div><div class="kpi-sub">${hotLeads} hot leads (score ≥70)</div></div>
          <div class="kpi-box"><div class="kpi-accent" style="background:#a000c8"></div><div class="kpi-label">Calls Made</div><div class="kpi-val">${calls}</div><div class="kpi-sub">${connected} connected · ${calls - connected} not reached</div></div>
          <div class="kpi-box"><div class="kpi-accent" style="background:#be2ed6"></div><div class="kpi-label">Site Visits</div><div class="kpi-val">${siteVisits}</div><div class="kpi-sub">${pctH(siteVisits, calls)}% of calls converted to visit</div></div>
          <div class="kpi-box"><div class="kpi-accent" style="background:#059669"></div><div class="kpi-label">Deals Won</div><div class="kpi-val">${wonDeals}</div><div class="kpi-sub">Revenue: ${fmtH(wonVal)}</div></div>
          <div class="kpi-box"><div class="kpi-accent" style="background:#059669"></div><div class="kpi-label">Win Rate</div><div class="kpi-val">${winRate}%</div><div class="kpi-sub">Out of ${closedDeals} closed deals</div></div>
          <div class="kpi-box"><div class="kpi-accent" style="background:#a000c8"></div><div class="kpi-label">Response Rate</div><div class="kpi-val">${responseRate}%</div><div class="kpi-sub">Leads contacted at least once</div></div>
        </div>
        ${pipelineVal > 0 ? `<div class="banner"><div><div class="banner-label">Active Pipeline Value</div><div class="banner-val">${fmtH(pipelineVal)}</div><div class="banner-note">Deals currently in progress (excl. won/lost)</div></div></div>` : ''}
      </div>

      ${sources.length > 0 ? `
      <div class="sec">
        <div class="sec-title">Lead Source Breakdown</div>
        <table class="tbl">
          <thead><tr><th>Source / Portal</th><th>Leads</th><th>Share</th><th>% of Total</th></tr></thead>
          <tbody>
            ${sources.map(([src,n]) => `
              <tr>
                <td style="font-weight:600">${src}</td>
                <td style="font-weight:700;color:#a000c8">${n}</td>
                <td style="width:200px">${bar(pctH(n,srcTotal))}</td>
                <td style="font-weight:700;color:#64748B">${pctH(n,srcTotal)}%</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      <div class="two-col">
        ${stageRows.length > 0 ? `
        <div class="sec">
          <div class="sec-title">Pipeline Stages</div>
          <table class="tbl">
            <thead><tr><th>Stage</th><th style="text-align:right">Count</th></tr></thead>
            <tbody>
              ${stageRows.map(([s,n]) => `
                <tr>
                  <td><span class="dot" style="background:${STAGE_COLOR[s]??'#94A3B8'}"></span>${STAGE_LABEL[s]??s}</td>
                  <td style="text-align:right;font-weight:700;color:${STAGE_COLOR[s]??'#0F172A'}">${n}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

        ${actRows.length > 0 ? `
        <div class="sec">
          <div class="sec-title">Activity Breakdown</div>
          <table class="tbl">
            <thead><tr><th>Activity Type</th><th style="text-align:right">Count</th></tr></thead>
            <tbody>
              ${actRows.map(([t,n]) => `
                <tr>
                  <td style="text-transform:capitalize">${t.replace(/_/g,' ')}</td>
                  <td style="text-align:right;font-weight:700;color:#a000c8">${n}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}
      </div>

      ${cities.length > 0 ? `
      <div class="sec">
        <div class="sec-title">City Focus</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${cities.map(([c,n])=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 13px;border:1px solid #E2E8F0;border-radius:20px"><span style="font-size:12px;font-weight:600">${c}</span><span style="font-size:11px;font-weight:700;background:rgba(160,0,200,0.07);color:#a000c8;padding:1px 7px;border-radius:10px">${n}</span></div>`).join('')}
        </div>
      </div>` : ''}
    `
  }

  else if (reportType === 'by-source') {
    const portals = Array.from(new Set(leads.map(l => l.sourcePortal ?? 'Direct')))
    const rows = portals.map(portal => {
      const pl  = leads.filter(l=>(l.sourcePortal??'Direct')===portal)
      const hot = pl.filter(l=>(l.intentScore??0)>=70).length
      const avg = pl.length ? Math.round(pl.reduce((s,l)=>s+(l.intentScore??0),0)/pl.length) : 0
      const dealsForLeads = deals.filter(d => pl.some(l=>{
        const name=[l.name.firstName,l.name.lastName].filter(Boolean).join(' ')
        return d.lead_name?.toLowerCase()===name.toLowerCase()
      }))
      const won = dealsForLeads.filter(d=>d.stage==='won').length
      return { portal, leads:pl.length, hot, avg, deals:dealsForLeads.length, won, conv:pctH(won,pl.length) }
    }).sort((a,b)=>b.leads-a.leads)

    const best = rows.length ? [...rows].sort((a,b)=>b.conv-a.conv)[0] : null

    const ptMap: Record<string,number> = {}
    for (const l of leads) { for (const p of (l.propertyType??['Residential'])) { ptMap[p]=(ptMap[p]??0)+1 } }
    const ptRows = Object.entries(ptMap).sort(([,a],[,b])=>b-a)
    const ptTotal = ptRows.reduce((s,[,v])=>s+v,0)

    body = `
      ${best ? `
      <div class="sec">
        <div class="sec-title">Executive Summary</div>
        <div class="two-col">
          <div class="highlight green">
            <div class="hl-label" style="color:#059669">Best Converting Source</div>
            <div class="hl-val">${best.portal}</div>
            <div class="hl-sub">${best.conv}% lead-to-deal conversion · ${best.leads} leads</div>
          </div>
          <div class="highlight">
            <div class="hl-label" style="color:#a000c8">Total Leads Analysed</div>
            <div class="hl-val">${leads.length}</div>
            <div class="hl-sub">Across ${rows.length} source${rows.length!==1?'s':''} · Period: ${period}</div>
          </div>
        </div>
      </div>` : ''}

      <div class="sec">
        <div class="sec-title">Source / Portal Breakdown</div>
        <table class="tbl">
          <thead><tr><th>Portal / Source</th><th>Leads</th><th>Hot Leads</th><th>Avg Score</th><th>Deals</th><th>Won</th><th>Conversion</th></tr></thead>
          <tbody>
            ${rows.map(r=>`
              <tr>
                <td style="font-weight:700">${r.portal}</td>
                <td style="font-weight:700;color:#a000c8">${r.leads}</td>
                <td style="color:${r.hot>0?'#059669':'#94A3B8'};font-weight:${r.hot>0?700:400}">${r.hot}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <div style="width:36px;height:5px;background:#E2E8F0;border-radius:3px"><div style="width:${r.avg}%;height:100%;background:${r.avg>=70?'#059669':r.avg>=50?'#be2ed6':'#94A3B8'};border-radius:3px"></div></div>
                    <span style="font-size:11px;color:#64748B">${r.avg}</span>
                  </div>
                </td>
                <td>${r.deals}</td>
                <td style="font-weight:700;color:${r.won>0?'#059669':'#94A3B8'}">${r.won}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:5px">
                    <div style="width:42px;height:6px;background:#E2E8F0;border-radius:3px"><div style="width:${r.conv}%;height:100%;background:${r.conv>=20?'#059669':r.conv>=10?'#be2ed6':'#94A3B8'};border-radius:3px"></div></div>
                    <span style="font-weight:700;font-size:11px;color:${r.conv>=20?'#059669':r.conv>=10?'#be2ed6':'#94A3B8'}">${r.conv}%</span>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      ${ptRows.length > 0 ? `
      <div class="sec">
        <div class="sec-title">Property Type Mix</div>
        <table class="tbl">
          <thead><tr><th>Property Type</th><th>Leads</th><th>Share</th><th>% Mix</th></tr></thead>
          <tbody>
            ${ptRows.map(([t,n])=>`
              <tr>
                <td style="font-weight:600">${t}</td>
                <td style="font-weight:700;color:#a000c8">${n}</td>
                <td style="width:180px">${bar(pctH(n,ptTotal),'#a000c8')}</td>
                <td style="font-weight:700;color:#64748B">${pctH(n,ptTotal)}%</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
    `
  }

  else if (reportType === 'seasonal') {
    const monthMap: Record<string,{leads:number;acts:number;won:number}> = {}
    const ensure = (k:string) => { if (!monthMap[k]) monthMap[k]={leads:0,acts:0,won:0} }
    for (const l of data.leads) {
      if (!l.createdAt) continue
      const d=new Date(l.createdAt); const k=`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`
      ensure(k); monthMap[k].leads++
    }
    for (const a of data.activities) {
      const d=new Date(a.createdAt); const k=`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`
      ensure(k); monthMap[k].acts++
    }
    for (const d of data.deals.filter(x=>x.stage==='won'&&x.created_at)) {
      const dt=new Date(d.created_at!); const k=`${dt.getFullYear()}-${String(dt.getMonth()).padStart(2,'0')}`
      ensure(k); monthMap[k].won++
    }
    const sorted = Object.entries(monthMap).sort(([a],[b])=>a.localeCompare(b)).slice(-12)
      .map(([k,v])=>{ const [yr,mo]=k.split('-'); return {label:`${MONTHS[Number(mo)]} ${yr}`,...v} })
    const maxL = Math.max(...sorted.map(r=>r.leads),1)
    const best  = sorted.length ? [...sorted].sort((a,b)=>b.leads-a.leads)[0]  : null
    const worst = sorted.length ? [...sorted].sort((a,b)=>a.leads-b.leads)[0]  : null

    body = `
      ${best ? `
      <div class="sec">
        <div class="sec-title">Highlights</div>
        <div class="two-col">
          <div class="highlight green">
            <div class="hl-label" style="color:#059669">Best Month</div>
            <div class="hl-val">${best.label}</div>
            <div class="hl-sub">${best.leads} leads · ${best.acts} activities${best.won?` · ${best.won} won`:''}</div>
          </div>
          <div class="highlight amber">
            <div class="hl-label" style="color:#be2ed6">Slowest Month</div>
            <div class="hl-val">${worst?.label??'—'}</div>
            <div class="hl-sub">${worst?.leads??0} leads · ${worst?.acts??0} activities</div>
          </div>
        </div>
      </div>` : ''}

      <div class="sec">
        <div class="sec-title">Monthly Performance — Last 12 Months</div>
        <table class="tbl">
          <thead><tr><th>Month</th><th>Leads Added</th><th>Trend</th><th>Activities</th><th>Deals Won</th></tr></thead>
          <tbody>
            ${sorted.map(r=>`
              <tr>
                <td style="font-weight:700">${r.label}</td>
                <td style="font-weight:700;color:#a000c8">${r.leads}</td>
                <td style="width:160px">${bar(pctH(r.leads,maxL))}</td>
                <td style="color:#a000c8;font-weight:${r.acts>0?600:400}">${r.acts}</td>
                <td style="color:${r.won>0?'#059669':'#94A3B8'};font-weight:${r.won>0?700:400}">${r.won>0?r.won:'—'}</td>
              </tr>`).join('')}
            ${sorted.length===0?'<tr><td colspan="5" style="color:#94A3B8;text-align:center;padding:20px">No historical data yet</td></tr>':''}
          </tbody>
        </table>
      </div>
    `
  }

  else if (reportType === 'pipeline') {
    const active   = deals.filter(d=>!['won','lost'].includes(d.stage))
    const won      = deals.filter(d=>d.stage==='won')
    const lost     = deals.filter(d=>d.stage==='lost')
    const pipeVal  = active.reduce((s,d)=>s+(d.deal_value??0),0)
    const wonVal   = won.reduce((s,d)=>s+(d.deal_value??0),0)
    const lostVal  = lost.reduce((s,d)=>s+(d.deal_value??0),0)
    const nearClose= deals.filter(d=>['negotiation','token_paid'].includes(d.stage))

    body = `
      <div class="sec">
        <div class="sec-title">Pipeline Summary</div>
        <div class="kpi-grid">
          <div class="kpi-box"><div class="kpi-accent" style="background:#a000c8"></div><div class="kpi-label">Active Pipeline</div><div class="kpi-val">${fmtH(pipeVal)}</div><div class="kpi-sub">${active.length} deals in progress</div></div>
          <div class="kpi-box"><div class="kpi-accent" style="background:#059669"></div><div class="kpi-label">Revenue Closed (Won)</div><div class="kpi-val">${fmtH(wonVal)}</div><div class="kpi-sub">${won.length} deals won</div></div>
          <div class="kpi-box"><div class="kpi-accent" style="background:#EF4444"></div><div class="kpi-label">Deals Lost</div><div class="kpi-val">${lost.length}</div><div class="kpi-sub">${fmtH(lostVal)} walked away</div></div>
        </div>
      </div>

      ${nearClose.length > 0 ? `
      <div class="sec">
        <div class="sec-title">Near Closing — Immediate Action Required</div>
        <div class="highlight" style="padding:14px 18px">
          ${nearClose.map(d=>`
            <div class="nc-row">
              <div>
                <span style="font-size:13px;font-weight:700">${d.lead_name}</span>
                <span style="font-size:11px;color:#64748B;margin-left:8px">${d.city??''}</span>
              </div>
              <div style="display:flex;align-items:center;gap:14px">
                <span style="font-size:12px;font-weight:600;color:${STAGE_COLOR[d.stage]??'#64748B'}">${STAGE_LABEL[d.stage]??d.stage}</span>
                <span style="font-size:14px;font-weight:800;color:#a000c8">${fmtH(d.deal_value??0)}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="sec">
        <div class="sec-title">All Deals</div>
        <table class="tbl">
          <thead><tr><th>#</th><th>Lead Name</th><th>Stage</th><th>City</th><th style="text-align:right">Deal Value</th></tr></thead>
          <tbody>
            ${deals.map((d,i)=>`
              <tr>
                <td style="color:#94A3B8;font-size:11px">${i+1}</td>
                <td style="font-weight:700">${d.lead_name}</td>
                <td><span class="dot" style="background:${STAGE_COLOR[d.stage]??'#94A3B8'}"></span><span style="color:${STAGE_COLOR[d.stage]??'#64748B'};font-weight:${['won','lost'].includes(d.stage)?700:500}">${STAGE_LABEL[d.stage]??d.stage}</span></td>
                <td style="color:#64748B">${d.city??'—'}</td>
                <td style="text-align:right;font-weight:700;font-size:13px;color:${d.stage==='won'?'#059669':d.stage==='lost'?'#EF4444':'#0F172A'}">${fmtH(d.deal_value??0)}</td>
              </tr>`).join('')}
            ${deals.length===0?'<tr><td colspan="5" style="color:#94A3B8;text-align:center;padding:20px">No deals yet</td></tr>':''}
          </tbody>
        </table>
      </div>
    `
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${titleLabel[reportType]} — ${agentName} — RealEdge CRM</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="page">
    ${header}
    <div class="rpt-body">${body}</div>
    ${footer}
  </div>
  <script>window.addEventListener('load',()=>{setTimeout(()=>{window.print()},400)})</script>
</body>
</html>`
}

function openPrintWindow(html: string) {
  const w = window.open('', '_blank', 'width=960,height=700')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string
  name: { firstName: string; lastName?: string }
  phones: { primaryPhoneNumber: string | null }
  city?: string | null
  intentScore?: number | null
  sourcePortal?: string | null
  propertyType?: string[] | null
  budgetMin?: number | null
  budgetMax?: number | null
  status?: string | null
  createdAt?: string | null
}
interface Activity {
  id: string
  type: string
  outcome?: string | null
  notes?: string | null
  createdAt: string
  personId: string
}
interface Deal {
  id: string
  lead_name: string
  deal_value?: number
  stage: string
  city?: string
  assigned_to?: string
  created_at?: string
}
interface TeamMember {
  id: string
  name: string
  role: string
  email?: string
  is_active: boolean
}
interface ReportData { leads: Lead[]; activities: Activity[]; deals: Deal[] }

// ─── Demo fallback ─────────────────────────────────────────────────────────────
const _n = Date.now(), _d = 86_400_000
const DEMO_ACTIVITIES: Activity[] = [
  {id:'da01',type:'call',             createdAt:new Date(_n-1*3600000).toISOString(),personId:'m1',outcome:'connected'},
  {id:'da02',type:'call',             createdAt:new Date(_n-3*3600000).toISOString(),personId:'m5',outcome:'connected'},
  {id:'da03',type:'whatsapp_message', createdAt:new Date(_n-5*3600000).toISOString(),personId:'m2'},
  {id:'da04',type:'call',             createdAt:new Date(_n-8*3600000).toISOString(),personId:'m3',outcome:'voicemail'},
  {id:'da05',type:'call',             createdAt:new Date(_n-0.5*_d).toISOString(),  personId:'m6',outcome:'connected'},
  {id:'da06',type:'site_visit',       createdAt:new Date(_n-1*_d).toISOString(),    personId:'m7'},
  {id:'da07',type:'call',             createdAt:new Date(_n-1*_d).toISOString(),    personId:'m1'},
  {id:'da08',type:'follow_up',        createdAt:new Date(_n-1.5*_d).toISOString(),  personId:'m4'},
  {id:'da09',type:'whatsapp_message', createdAt:new Date(_n-2*_d).toISOString(),    personId:'m8'},
  {id:'da10',type:'call',             createdAt:new Date(_n-2*_d).toISOString(),    personId:'m5'},
  {id:'da11',type:'call',             createdAt:new Date(_n-3*_d).toISOString(),    personId:'m2',outcome:'connected'},
  {id:'da12',type:'site_visit',       createdAt:new Date(_n-3*_d).toISOString(),    personId:'m6'},
  {id:'da13',type:'call',             createdAt:new Date(_n-4*_d).toISOString(),    personId:'m9'},
  {id:'da14',type:'whatsapp_message', createdAt:new Date(_n-4*_d).toISOString(),    personId:'m3'},
  {id:'da15',type:'call',             createdAt:new Date(_n-5*_d).toISOString(),    personId:'m1',outcome:'voicemail'},
  {id:'da16',type:'negotiation_call', createdAt:new Date(_n-5*_d).toISOString(),    personId:'m7'},
  {id:'da17',type:'call',             createdAt:new Date(_n-6*_d).toISOString(),    personId:'m4'},
  {id:'da18',type:'whatsapp_message', createdAt:new Date(_n-7*_d).toISOString(),    personId:'m2'},
  {id:'da19',type:'call',             createdAt:new Date(_n-8*_d).toISOString(),    personId:'m5'},
  {id:'da20',type:'site_visit',       createdAt:new Date(_n-9*_d).toISOString(),    personId:'m8'},
  {id:'da21',type:'call',             createdAt:new Date(_n-10*_d).toISOString(),   personId:'m6'},
  {id:'da22',type:'follow_up',        createdAt:new Date(_n-12*_d).toISOString(),   personId:'m3'},
  {id:'da23',type:'call',             createdAt:new Date(_n-14*_d).toISOString(),   personId:'m1',outcome:'connected'},
  {id:'da24',type:'whatsapp_message', createdAt:new Date(_n-15*_d).toISOString(),   personId:'m9'},
  {id:'da25',type:'call',             createdAt:new Date(_n-18*_d).toISOString(),   personId:'m2'},
  {id:'da26',type:'negotiation_call', createdAt:new Date(_n-20*_d).toISOString(),   personId:'m7'},
  {id:'da27',type:'call',             createdAt:new Date(_n-22*_d).toISOString(),   personId:'m4'},
  {id:'da28',type:'site_visit',       createdAt:new Date(_n-25*_d).toISOString(),   personId:'m5'},
]
const DEMO_DEALS: Deal[] = [
  {id:'dd1',lead_name:'Aditya Joshi', deal_value:12_000_000,stage:'won',        city:'Mumbai',   created_at:new Date(_n-5*_d).toISOString()},
  {id:'dd2',lead_name:'Karthik Balan',deal_value: 7_500_000,stage:'won',        city:'Bangalore',created_at:new Date(_n-12*_d).toISOString()},
  {id:'dd3',lead_name:'Meera Pillai', deal_value: 9_200_000,stage:'token_paid', city:'Chennai',  created_at:new Date(_n-3*_d).toISOString()},
  {id:'dd4',lead_name:'Rahul Mehta',  deal_value: 8_500_000,stage:'negotiation',city:'Mumbai',   created_at:new Date(_n-2*_d).toISOString()},
  {id:'dd5',lead_name:'Priya Sharma', deal_value: 4_200_000,stage:'site_visit', city:'Pune',     created_at:new Date(_n-7*_d).toISOString()},
  {id:'dd6',lead_name:'Vikram Singh', deal_value: 5_800_000,stage:'lost',       city:'Hyderabad',created_at:new Date(_n-20*_d).toISOString()},
]
const DEMO_MEMBERS: TeamMember[] = [
  {id:'dm1',name:'Rahul Mehta',  role:'senior_agent',is_active:true,email:'rahul@realedge.in'},
  {id:'dm2',name:'Priya Sharma', role:'agent',       is_active:true,email:'priya@realedge.in'},
  {id:'dm3',name:'Aditya Joshi', role:'agent',       is_active:true,email:'aditya@realedge.in'},
]

// ─── Small helpers ─────────────────────────────────────────────────────────────
const STAGE_LABEL: Record<string,string> = {new:'New',site_visit:'Site Visit',negotiation:'Negotiation',token_paid:'Token Paid',won:'Won',lost:'Lost'}
const STAGE_COLOR: Record<string,string> = {new:LABEL,site_visit:BLUE,negotiation:AMBER,token_paid:VIOLET,won:GREEN,lost:'#EF4444'}

function KpiCard({label,value,sub,color,icon}:{label:string;value:string|number;sub?:string;color:string;icon:React.ReactNode}) {
  return (
    <div className="kpi-card" style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:14,padding:'14px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:'0.07em'}}>{label}</span>
        <div style={{width:28,height:28,borderRadius:8,background:`${color}15`,display:'flex',alignItems:'center',justifyContent:'center',color}}>{icon}</div>
      </div>
      <div style={{fontSize:24,fontWeight:800,color:TEXT,letterSpacing:'-0.02em',lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:11,color:MUTED,marginTop:4}}>{sub}</div>}
    </div>
  )
}

function SectionHead({title,icon}:{title:string;icon?:React.ReactNode}) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:7,padding:'11px 14px',borderBottom:`1px solid ${BORDER}`}}>
      {icon && <span style={{color:MUTED,display:'flex'}}>{icon}</span>}
      <span style={{fontSize:12,fontWeight:700,color:TEXT}}>{title}</span>
    </div>
  )
}

// ─── Report: Productivity ──────────────────────────────────────────────────────
function ProductivityView({data,range}:{data:ReportData;range:string}) {
  const since    = sinceDate(range)
  const leads    = data.leads.filter(l => !l.createdAt || new Date(l.createdAt) >= since)
  const acts     = data.activities.filter(a => new Date(a.createdAt) >= since)
  const deals    = data.deals

  const totalLeads   = leads.length
  const hotLeads     = leads.filter(l => (l.intentScore??0)>=70).length
  const calls        = acts.filter(a => a.type?.toLowerCase().includes('call')).length
  const connected    = acts.filter(a => a.outcome?.toLowerCase().includes('connect')).length
  const siteVisits   = acts.filter(a => a.type === 'site_visit').length
  const wonDeals     = deals.filter(d => d.stage==='won').length
  const closedDeals  = deals.filter(d => ['won','lost'].includes(d.stage)).length
  const winRate      = pct(wonDeals, closedDeals)
  const pipelineVal  = deals.filter(d => !['won','lost'].includes(d.stage)).reduce((s,d)=>s+(d.deal_value??0),0)
  const wonVal       = deals.filter(d => d.stage==='won').reduce((s,d)=>s+(d.deal_value??0),0)
  const responseRate = pct(leads.filter(l => acts.some(a => a.personId===l.id)).length, totalLeads)

  // Source breakdown
  const srcMap: Record<string,number> = {}
  for (const l of leads) { const s=l.sourcePortal??'Direct'; srcMap[s]=(srcMap[s]??0)+1 }
  const sources = Object.entries(srcMap).sort(([,a],[,b])=>b-a)
  const srcTotal = sources.reduce((s,[,v])=>s+v,0)

  // Stage breakdown
  const stageMap: Record<string,number> = {}
  for (const d of deals.filter(x=>x.stage!=='lost')) { stageMap[d.stage]=(stageMap[d.stage]??0)+1 }
  const stages = Object.entries(stageMap).sort(([,a],[,b])=>b-a)

  // Activity breakdown
  const actMap: Record<string,number> = {}
  for (const a of acts) { const t=a.type??'Other'; actMap[t]=(actMap[t]??0)+1 }
  const actTypes = Object.entries(actMap).sort(([,a],[,b])=>b-a)

  // City breakdown
  const cityMap: Record<string,number> = {}
  for (const l of leads) { const c=l.city??'Unknown'; cityMap[c]=(cityMap[c]??0)+1 }
  const cities = Object.entries(cityMap).sort(([,a],[,b])=>b-a).slice(0,6)

  return (
    <div>
      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
        <KpiCard label="Leads Added"   value={totalLeads}    sub={`${hotLeads} hot leads`}          color={BLUE}   icon={<TrendingUp size={13}/>}/>
        <KpiCard label="Calls Made"    value={calls}         sub={`${connected} connected`}          color={VIOLET} icon={<Activity size={13}/>}/>
        <KpiCard label="Site Visits"   value={siteVisits}    sub={`${pct(siteVisits,calls)}% of calls`} color={AMBER}  icon={<MapPin size={13}/>}/>
        <KpiCard label="Deals Won"     value={wonDeals}      sub={fmt(wonVal)}                       color={GREEN}  icon={<Trophy size={13}/>}/>
        <KpiCard label="Win Rate"      value={`${winRate}%`} sub={`${closedDeals} closed`}           color={GREEN}  icon={<Target size={13}/>}/>
        <KpiCard label="Response Rate" value={`${responseRate}%`} sub="leads contacted"             color={BLUE}   icon={<Activity size={13}/>}/>
      </div>

      {/* Pipeline value */}
      {pipelineVal > 0 && (
        <div style={{background:BLUE_D,border:`1px solid rgba(160,0,200,0.2)`,borderRadius:12,padding:'12px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:BLUE,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:2}}>Active Pipeline Value</div>
            <div style={{fontSize:22,fontWeight:800,color:TEXT,letterSpacing:'-0.02em'}}>{fmt(pipelineVal)}</div>
          </div>
          <BarChart2 size={26} color={BLUE} style={{opacity:0.35}}/>
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden',marginBottom:12}}>
          <SectionHead title="Lead Sources" icon={<FileText size={12}/>}/>
          {sources.map(([src,count]) => {
            const p = pct(count, srcTotal)
            return (
              <div key={src} style={{padding:'10px 14px',borderBottom:`1px solid #F8FAFC`,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:12,fontWeight:600,color:TEXT,minWidth:110}}>{src}</span>
                <div style={{flex:1,height:6,background:'#F1F5F9',borderRadius:3}}>
                  <div style={{height:'100%',background:BLUE,borderRadius:3,width:`${p}%`}}/>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:BLUE,minWidth:24,textAlign:'right'}}>{count}</span>
                <span style={{fontSize:11,color:LABEL,minWidth:32,textAlign:'right'}}>{p}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Stage + Activity side by side */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden'}}>
          <SectionHead title="Pipeline Stages" icon={<GitBranch size={12}/>}/>
          {stages.length===0
            ? <div style={{padding:'16px 14px',fontSize:12,color:LABEL}}>No deals yet</div>
            : stages.map(([s,n]) => (
                <div key={s} style={{padding:'9px 14px',borderBottom:`1px solid #F8FAFC`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:STAGE_COLOR[s]??LABEL,flexShrink:0}}/>
                    <span style={{fontSize:12,color:TEXT}}>{STAGE_LABEL[s]??s}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:STAGE_COLOR[s]??TEXT}}>{n}</span>
                </div>
              ))
          }
        </div>
        <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden'}}>
          <SectionHead title="Activities" icon={<Activity size={12}/>}/>
          {actTypes.length===0
            ? <div style={{padding:'16px 14px',fontSize:12,color:LABEL}}>No activities yet</div>
            : actTypes.map(([t,n]) => (
                <div key={t} style={{padding:'9px 14px',borderBottom:`1px solid #F8FAFC`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,color:TEXT,textTransform:'capitalize'}}>{t.replace(/_/g,' ')}</span>
                  <span style={{fontSize:13,fontWeight:700,color:VIOLET}}>{n}</span>
                </div>
              ))
          }
        </div>
      </div>

      {/* Cities */}
      {cities.length > 0 && (
        <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden'}}>
          <SectionHead title="City Focus" icon={<MapPin size={12}/>}/>
          <div style={{padding:'12px 14px',display:'flex',flexWrap:'wrap',gap:8}}>
            {cities.map(([city,count]) => (
              <div key={city} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',background:BG,border:`1px solid ${BORDER}`,borderRadius:20}}>
                <span style={{fontSize:12,fontWeight:600,color:TEXT}}>{city}</span>
                <span style={{fontSize:11,fontWeight:700,color:BLUE,background:BLUE_D,borderRadius:10,padding:'1px 6px'}}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Report: By Source / Portal ────────────────────────────────────────────────
function BySourceView({data,range}:{data:ReportData;range:string}) {
  const since = sinceDate(range)
  const leads  = data.leads.filter(l => !l.createdAt || new Date(l.createdAt) >= since)

  const portals = Array.from(new Set(leads.map(l=>l.sourcePortal??'Direct')))
  const rows = portals.map(portal => {
    const pl  = leads.filter(l=>(l.sourcePortal??'Direct')===portal)
    const hot = pl.filter(l=>(l.intentScore??0)>=70).length
    const avg = pl.length ? Math.round(pl.reduce((s,l)=>s+(l.intentScore??0),0)/pl.length) : 0
    const dealsForLeads = data.deals.filter(d => pl.some(l=>{
      const name = [l.name.firstName,l.name.lastName].filter(Boolean).join(' ')
      return d.lead_name?.toLowerCase()===name.toLowerCase()
    }))
    const won = dealsForLeads.filter(d=>d.stage==='won').length
    return { portal, leads: pl.length, hot, avg, deals: dealsForLeads.length, won, convPct: pct(won, pl.length) }
  }).sort((a,b)=>b.leads-a.leads)

  const best = rows.reduce((m,r)=>r.convPct>m.convPct?r:m, rows[0]??{portal:'',convPct:0})

  return (
    <div>
      {best?.portal && (
        <div style={{background:BLUE_D,border:`1px solid rgba(160,0,200,0.2)`,borderRadius:12,padding:'12px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:BLUE,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:2}}>Best Converting Source</div>
            <div style={{fontSize:18,fontWeight:800,color:TEXT}}>{best.portal}</div>
            <div style={{fontSize:12,color:MUTED}}>{best.convPct}% lead-to-won conversion</div>
          </div>
          <Trophy size={28} color={BLUE} style={{opacity:0.4}}/>
        </div>
      )}

      <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden'}}>
        <SectionHead title="Source / Portal Breakdown"/>
        {/* Header row */}
        <div style={{display:'grid',gridTemplateColumns:'1.6fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr',padding:'8px 14px',background:'#F8FAFC',borderBottom:`1px solid ${BORDER}`}}>
          {['Portal','Leads','Hot','Avg Score','Deals','Won','Conversion'].map(h=>(
            <span key={h} style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</span>
          ))}
        </div>
        {rows.map(r => (
          <div key={r.portal} style={{display:'grid',gridTemplateColumns:'1.6fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr',padding:'10px 14px',borderBottom:`1px solid #F8FAFC`,alignItems:'center'}}>
            <span style={{fontSize:13,fontWeight:600,color:TEXT}}>{r.portal}</span>
            <span style={{fontSize:13,fontWeight:700,color:TEXT}}>{r.leads}</span>
            <span style={{fontSize:13,color:r.hot>0?GREEN:LABEL}}>{r.hot}</span>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <div style={{width:28,height:4,background:'#F1F5F9',borderRadius:2}}>
                <div style={{height:'100%',background:r.avg>=70?GREEN:r.avg>=50?AMBER:LABEL,borderRadius:2,width:`${r.avg}%`}}/>
              </div>
              <span style={{fontSize:12,color:MUTED}}>{r.avg}</span>
            </div>
            <span style={{fontSize:13,color:MUTED}}>{r.deals}</span>
            <span style={{fontSize:13,fontWeight:700,color:r.won>0?GREEN:LABEL}}>{r.won}</span>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{flex:1,height:6,background:'#F1F5F9',borderRadius:3,maxWidth:60}}>
                <div style={{height:'100%',background:r.convPct>=20?GREEN:r.convPct>=10?AMBER:LABEL,borderRadius:3,width:`${r.convPct}%`}}/>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:r.convPct>=20?GREEN:TEXT}}>{r.convPct}%</span>
            </div>
          </div>
        ))}
        {rows.length===0 && <div style={{padding:'24px 14px',fontSize:12,color:LABEL}}>No lead source data for this period.</div>}
      </div>

      {/* Property type mix */}
      {(() => {
        const ptMap: Record<string,number> = {}
        for (const l of leads) { for (const p of (l.propertyType??['Residential'])) { ptMap[p]=(ptMap[p]??0)+1 } }
        const pts = Object.entries(ptMap).sort(([,a],[,b])=>b-a)
        const total = pts.reduce((s,[,v])=>s+v,0)
        if (!pts.length) return null
        return (
          <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden',marginTop:12}}>
            <SectionHead title="Property Type Mix"/>
            {pts.map(([t,n])=>(
              <div key={t} style={{padding:'10px 14px',borderBottom:`1px solid #F8FAFC`,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:12,fontWeight:600,color:TEXT,minWidth:120}}>{t}</span>
                <div style={{flex:1,height:6,background:'#F1F5F9',borderRadius:3}}>
                  <div style={{height:'100%',background:VIOLET,borderRadius:3,width:`${pct(n,total)}%`}}/>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:VIOLET,minWidth:24,textAlign:'right'}}>{n}</span>
                <span style={{fontSize:11,color:LABEL,minWidth:32,textAlign:'right'}}>{pct(n,total)}%</span>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Report: Seasonal / Monthly ────────────────────────────────────────────────
function SeasonalView({data}:{data:ReportData}) {
  // Build monthly buckets from all-time data
  const monthMap: Record<string,{leads:number;acts:number;won:number}> = {}
  const ensure = (k:string) => { if (!monthMap[k]) monthMap[k]={leads:0,acts:0,won:0} }

  for (const l of data.leads) {
    if (!l.createdAt) continue
    const d = new Date(l.createdAt)
    const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`
    ensure(k); monthMap[k].leads++
  }
  for (const a of data.activities) {
    const d = new Date(a.createdAt)
    const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`
    ensure(k); monthMap[k].acts++
  }
  for (const d of data.deals.filter(x=>x.stage==='won' && x.created_at)) {
    const dt = new Date(d.created_at!)
    const k  = `${dt.getFullYear()}-${String(dt.getMonth()).padStart(2,'0')}`
    ensure(k); monthMap[k].won++
  }

  const sorted = Object.entries(monthMap)
    .sort(([a],[b])=>a.localeCompare(b))
    .slice(-12)
    .map(([k,v])=>{
      const [yr,mo]=k.split('-')
      return { label:`${MONTHS[Number(mo)]} ${yr}`, ...v }
    })

  const maxLeads = Math.max(...sorted.map(r=>r.leads), 1)

  // Best/worst month
  const best  = [...sorted].sort((a,b)=>b.leads-a.leads)[0]
  const worst = [...sorted].sort((a,b)=>a.leads-b.leads)[0]

  return (
    <div>
      {sorted.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          <div style={{background:BLUE_D,border:`1px solid rgba(160,0,200,0.2)`,borderRadius:12,padding:'12px 16px'}}>
            <div style={{fontSize:10,fontWeight:700,color:BLUE,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:2}}>Best Month</div>
            <div style={{fontSize:18,fontWeight:800,color:TEXT}}>{best?.label}</div>
            <div style={{fontSize:12,color:MUTED}}>{best?.leads} leads · {best?.acts} activities</div>
          </div>
          <div style={{background:AMBER_D,border:`1px solid ${AMBER}30`,borderRadius:12,padding:'12px 16px'}}>
            <div style={{fontSize:10,fontWeight:700,color:AMBER,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:2}}>Slowest Month</div>
            <div style={{fontSize:18,fontWeight:800,color:TEXT}}>{worst?.label}</div>
            <div style={{fontSize:12,color:MUTED}}>{worst?.leads} leads · {worst?.acts} activities</div>
          </div>
        </div>
      )}

      <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden'}}>
        <SectionHead title="Monthly Performance (last 12 months)" icon={<Calendar size={12}/>}/>
        {sorted.length===0
          ? <div style={{padding:'24px 14px',fontSize:12,color:LABEL}}>Not enough historical data yet.</div>
          : sorted.map(row=>(
              <div key={row.label} style={{padding:'10px 14px',borderBottom:`1px solid #F8FAFC`,display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:12,fontWeight:600,color:TEXT,minWidth:80}}>{row.label}</span>
                <div style={{flex:1}}>
                  <div style={{height:8,background:'#F1F5F9',borderRadius:4}}>
                    <div style={{height:'100%',background:BLUE,borderRadius:4,width:`${pct(row.leads,maxLeads)}%`,minWidth:row.leads>0?4:0}}/>
                  </div>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:TEXT,minWidth:28,textAlign:'right'}}>{row.leads}</span>
                <span style={{fontSize:11,color:MUTED,minWidth:60}}>leads</span>
                <span style={{fontSize:12,color:VIOLET,fontWeight:600,minWidth:40,textAlign:'right'}}>{row.acts} acts</span>
                <span style={{fontSize:12,color:GREEN, fontWeight:600,minWidth:36,textAlign:'right'}}>{row.won>0?`${row.won} won`:''}</span>
              </div>
            ))
        }
      </div>
    </div>
  )
}

// ─── Report: Pipeline ──────────────────────────────────────────────────────────
function PipelineView({data}:{data:ReportData}) {
  const active = data.deals.filter(d=>!['won','lost'].includes(d.stage))
  const won    = data.deals.filter(d=>d.stage==='won')
  const lost   = data.deals.filter(d=>d.stage==='lost')
  const pipeVal= active.reduce((s,d)=>s+(d.deal_value??0),0)
  const wonVal = won.reduce((s,d)=>s+(d.deal_value??0),0)
  const nearClose = data.deals.filter(d=>['negotiation','token_paid'].includes(d.stage))

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
        <KpiCard label="Active Pipeline"  value={fmt(pipeVal)} sub={`${active.length} deals`}  color={BLUE}  icon={<BarChart2 size={13}/>}/>
        <KpiCard label="Revenue Closed"   value={fmt(wonVal)}  sub={`${won.length} deals won`}  color={GREEN} icon={<Trophy size={13}/>}/>
        <KpiCard label="Lost Deals"       value={lost.length}  sub={`${fmt(lost.reduce((s,d)=>s+(d.deal_value??0),0))} lost`} color={AMBER} icon={<Target size={13}/>}/>
      </div>

      {nearClose.length > 0 && (
        <div style={{background:BLUE_D,border:`1px solid rgba(160,0,200,0.2)`,borderRadius:12,padding:'12px 16px',marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:BLUE,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Near Closing — Action Required</div>
          {nearClose.map(d=>(
            <div key={d.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:`1px solid ${BLUE}15`}}>
              <div>
                <span style={{fontSize:13,fontWeight:600,color:TEXT}}>{d.lead_name}</span>
                <span style={{fontSize:11,color:MUTED,marginLeft:8}}>{d.city}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:12,color:STAGE_COLOR[d.stage]??MUTED,fontWeight:600}}>{STAGE_LABEL[d.stage]}</span>
                <span style={{fontSize:13,fontWeight:700,color:BLUE}}>{fmt(d.deal_value??0)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All deals table */}
      <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden'}}>
        <SectionHead title="All Deals"/>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',padding:'8px 14px',background:'#F8FAFC',borderBottom:`1px solid ${BORDER}`}}>
          {['Lead','Stage','City','Value'].map(h=><span key={h} style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</span>)}
        </div>
        {data.deals.length===0
          ? <div style={{padding:'24px 14px',fontSize:12,color:LABEL}}>No deals yet.</div>
          : data.deals.map(d=>(
              <div key={d.id} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',padding:'9px 14px',borderBottom:`1px solid #F8FAFC`,alignItems:'center'}}>
                <span style={{fontSize:12,fontWeight:600,color:TEXT}}>{d.lead_name}</span>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:STAGE_COLOR[d.stage]??LABEL}}/>
                  <span style={{fontSize:12,color:STAGE_COLOR[d.stage]??MUTED}}>{STAGE_LABEL[d.stage]??d.stage}</span>
                </div>
                <span style={{fontSize:12,color:MUTED}}>{d.city??'—'}</span>
                <span style={{fontSize:12,fontWeight:700,color:d.stage==='won'?GREEN:TEXT}}>{fmt(d.deal_value??0)}</span>
              </div>
            ))
        }
      </div>
    </div>
  )
}

// ─── Report wrapper (screen) ───────────────────────────────────────────────────
function ReportDoc({agentName,agentRole,range,reportType,isDemo,data,children}:{
  agentName:string; agentRole:string; range:string; reportType:ReportType;
  isDemo:boolean; data:ReportData; children:React.ReactNode
}) {
  const today    = new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})
  const typeLabel: Record<string,string> = {
    productivity:'Productivity Report',
    'by-source':'Lead Source & Portal Report',
    seasonal:'Seasonal Performance Report',
    pipeline:'Pipeline Report',
  }

  const handlePrint = () => {
    const html = buildPrintHTML(agentName, agentRole, range, reportType, data, isDemo)
    openPrintWindow(html)
  }

  const shareEmail = () => {
    const subject = encodeURIComponent(`${typeLabel[reportType]} — ${agentName} — ${rangeLabel(range)}`)
    const body    = encodeURIComponent(`${typeLabel[reportType]}\nAgent: ${agentName}\nPeriod: ${rangeLabel(range)}\nGenerated: ${today}\n\nPlease find the report attached (or view in RealEdge CRM).\n\nSent via RealEdge CRM`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  return (
    <div>
      {/* Action bar */}
      <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {isDemo && (
          <span style={{fontSize:9,fontWeight:800,background:AMBER_D,color:AMBER,border:`1px solid ${AMBER}30`,borderRadius:20,padding:'4px 10px',textTransform:'uppercase',letterSpacing:'0.06em'}}>
            Sample data
          </span>
        )}
        <button onClick={shareEmail} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',border:`1px solid ${BORDER}`,borderRadius:9,background:PANEL,color:MUTED,fontSize:12,fontWeight:600,cursor:'pointer'}}>
          <Mail size={12}/> Share via Email
        </button>
        <button onClick={handlePrint} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',border:`1px solid ${BLUE}`,borderRadius:9,background:BLUE,color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer'}}>
          <Printer size={12}/> Print / Save PDF
        </button>
      </div>

      {/* On-screen document header */}
      <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:14,padding:'18px 20px',marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:BLUE,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>RealEdge CRM</div>
            <div style={{fontSize:20,fontWeight:800,color:TEXT,letterSpacing:'-0.01em'}}>{typeLabel[reportType]}</div>
            <div style={{fontSize:13,color:MUTED,marginTop:4}}>
              <strong style={{color:TEXT}}>{agentName}</strong>
              &nbsp;·&nbsp;Period: {rangeLabel(range)}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:LABEL}}>Generated</div>
            <div style={{fontSize:13,fontWeight:600,color:TEXT}}>{today}</div>
          </div>
        </div>
      </div>

      {children}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
const REPORT_TYPES: {id:ReportType; label:string; icon:React.ReactNode}[] = [
  {id:'productivity', label:'Productivity',  icon:<LayoutGrid size={12}/>},
  {id:'by-source',    label:'By Source',     icon:<FileText size={12}/>},
  {id:'seasonal',     label:'Seasonal',      icon:<Calendar size={12}/>},
  {id:'pipeline',     label:'Pipeline',      icon:<GitBranch size={12}/>},
]

export default function ReportsPage() {
  const [tab,         setTab]        = useState<'mine'|'team'>('mine')
  const [range,       setRange]      = useState('30d')
  const [reportType,  setReportType] = useState<ReportType>('productivity')
  const [data,        setData]       = useState<ReportData>({leads:[],activities:[],deals:[]})
  const [loading,     setLoading]    = useState(true)
  const [members,     setMembers]    = useState<TeamMember[]>([])
  const [activeAgent, setActiveAgent]= useState<TeamMember|null>(null)
  const [plan,        setPlanState]  = useState<'solo'|'teams'>('solo')
  const [role,        setRole]       = useState<'admin'|'agent'>('admin')
  const [isDemo,      setIsDemo]     = useState(false)
  const [myName,      setMyName]     = useState('Me')

  useEffect(()=>{
    setPlanState(getPlan()); setRole(getRole())
    const sync=()=>{setPlanState(getPlan());setRole(getRole())}
    window.addEventListener('plan-changed',sync)
    return ()=>window.removeEventListener('plan-changed',sync)
  },[])

  const load = useCallback(async()=>{
    setLoading(true)
    try {
      const [lr,ar,dr] = await Promise.all([
        fetch('/api/crm/leads?limit=500').then(r=>r.json()),
        fetch('/api/crm/activities?limit=500').then(r=>r.json()),
        fetch('/api/deals').then(r=>r.json()),
      ])
      const leads: Lead[]       = lr.data?.leads ?? lr.data ?? lr.leads ?? []
      const liveActs: Activity[]= ar.data?.activities ?? ar.data ?? ar.activities ?? []
      const liveDeals: Deal[]   = dr.data ?? dr.deals ?? []
      const usingDemo = liveActs.length===0 && liveDeals.length===0
      setIsDemo(usingDemo)
      setData({leads, activities: liveActs.length>0?liveActs:DEMO_ACTIVITIES, deals: liveDeals.length>0?liveDeals:DEMO_DEALS})

      if (plan==='teams' && role==='admin') {
        const mr = await fetch('/api/team').then(r=>r.json())
        const ms: TeamMember[] = mr.members ?? []
        setMembers(ms.length>0?ms:DEMO_MEMBERS)
      }
      // Try to get logged-in user name from team or a profile endpoint
      const profileName = leads[0] ? undefined : undefined // placeholder
      setMyName(profileName ?? 'Me')
    } catch { /* silent */ }
    finally { setLoading(false) }
  },[plan,role])

  useEffect(()=>{load()},[load])

  const isTeamsAdmin = plan==='teams' && role==='admin'
  const displayAgent = tab==='team' && activeAgent ? activeAgent.name : myName
  const displayData  = data // in dev, all data is one user — same for everyone

  const tabBtn = (active:boolean):React.CSSProperties => ({
    padding:'8px 18px',borderRadius:10,fontSize:13,fontWeight:700,
    border:'none',cursor:'pointer',
    background:active?BLUE:'transparent',
    color:active?'#fff':MUTED,
    display:'flex',alignItems:'center',gap:6,
  })

  const rtBtn = (active:boolean):React.CSSProperties => ({
    padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,
    border:`1px solid ${active?BLUE:BORDER}`,cursor:'pointer',
    background:active?BLUE_D:PANEL,
    color:active?BLUE:MUTED,
    display:'flex',alignItems:'center',gap:5,
  })

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-content, #report-content * { visibility: visible; }
          #report-content { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
          .kpi-card { break-inside: avoid; }
          @page { margin: 1.5cm; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{minHeight:'100vh',background:BG,padding:'24px 28px 48px'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18,flexWrap:'wrap',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:36,height:36,borderRadius:10,background:VIOLET_D,border:`1px solid ${VIOLET}25`,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <FileText size={16} color={VIOLET}/>
            </div>
            <div>
              <h1 style={{fontSize:18,fontWeight:800,color:TEXT,margin:0,letterSpacing:'-0.01em'}}>Reports</h1>
              <p style={{fontSize:12,color:MUTED,margin:0}}>Auto-generated. Ready to download and share.</p>
            </div>
          </div>
          <button onClick={load} className="no-print" style={{display:'flex',alignItems:'center',gap:5,padding:'7px 14px',border:`1px solid ${BORDER}`,borderRadius:9,background:PANEL,color:MUTED,fontSize:12,fontWeight:600,cursor:'pointer'}}>
            <RefreshCw size={12}/> Refresh
          </button>
        </div>

        {/* Tab row */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
          <div className="no-print" style={{display:'flex',gap:4,background:'#F1F5F9',borderRadius:12,padding:4}}>
            <button style={tabBtn(tab==='mine')} onClick={()=>setTab('mine')}>
              <User size={13}/> My Report
            </button>
            {isTeamsAdmin ? (
              <button style={tabBtn(tab==='team')} onClick={()=>setTab('team')}>
                <Users size={13}/> Team Reports
              </button>
            ) : (
              <div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 18px',borderRadius:10,color:LABEL,fontSize:13,fontWeight:700,opacity:0.6}}>
                <Lock size={12}/> Team Reports
                <span style={{fontSize:9,fontWeight:800,background:AMBER_D,color:AMBER,border:`1px solid ${AMBER}30`,borderRadius:20,padding:'1px 6px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Teams</span>
              </div>
            )}
          </div>

          {/* Time range */}
          <div className="no-print" style={{display:'flex',gap:4,background:'#F1F5F9',borderRadius:10,padding:3}}>
            {RANGES.map(r=>(
              <button key={r.id} onClick={()=>setRange(r.id)}
                style={{padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,border:'none',cursor:'pointer',background:range===r.id?PANEL:'transparent',color:range===r.id?TEXT:MUTED,boxShadow:range===r.id?'0 1px 4px rgba(0,0,0,0.08)':'none'}}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Report type selector */}
        <div className="no-print" style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          {REPORT_TYPES.map(rt=>(
            <button key={rt.id} style={rtBtn(reportType===rt.id)} onClick={()=>setReportType(rt.id)}>
              {rt.icon} {rt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{display:'flex',alignItems:'center',gap:10,color:MUTED,padding:40}}>
            <Loader2 size={18} style={{animation:'spin 1s linear infinite'}}/> Loading report…
          </div>
        ) : tab==='mine' ? (
          <div id="report-content" style={{maxWidth:800}}>
            <ReportDoc agentName={myName} agentRole="" range={range} reportType={reportType} isDemo={isDemo} data={displayData}>
              {reportType==='productivity' && <ProductivityView  data={displayData} range={range}/>}
              {reportType==='by-source'   && <BySourceView       data={displayData} range={range}/>}
              {reportType==='seasonal'    && <SeasonalView       data={displayData}/>}
              {reportType==='pipeline'    && <PipelineView       data={displayData}/>}
            </ReportDoc>
          </div>
        ) : (
          /* Team Reports */
          <div style={{display:'flex',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
            {/* Agent list */}
            <div className="no-print" style={{width:220,flexShrink:0}}>
              <p style={{fontSize:10,fontWeight:700,color:LABEL,textTransform:'uppercase',letterSpacing:'0.07em',margin:'0 0 8px 2px'}}>Select Agent</p>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {members.map(m=>{
                  const sel = activeAgent?.id===m.id
                  return (
                    <button key={m.id} onClick={()=>setActiveAgent(sel?null:m)}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:12,border:`1.5px solid ${sel?BLUE:BORDER}`,background:sel?BLUE_D:PANEL,cursor:'pointer',textAlign:'left',transition:'all 0.12s'}}>
                      <div style={{width:32,height:32,borderRadius:10,background:sel?BLUE:`${VIOLET}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:sel?'#fff':VIOLET,flexShrink:0}}>
                        {m.name.charAt(0)}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:sel?BLUE:TEXT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</div>
                        <div style={{fontSize:10,color:MUTED,textTransform:'capitalize'}}>{m.role.replace('_',' ')}</div>
                      </div>
                      {sel && <ChevronRight size={13} color={BLUE}/>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Agent report */}
            <div id="report-content" style={{flex:1,minWidth:0,maxWidth:800}}>
              {activeAgent ? (
                <ReportDoc agentName={activeAgent.name} agentRole={activeAgent.role} range={range} reportType={reportType} isDemo={isDemo} data={displayData}>
                  {reportType==='productivity' && <ProductivityView  data={displayData} range={range}/>}
                  {reportType==='by-source'   && <BySourceView       data={displayData} range={range}/>}
                  {reportType==='seasonal'    && <SeasonalView       data={displayData}/>}
                  {reportType==='pipeline'    && <PipelineView       data={displayData}/>}
                </ReportDoc>
              ) : (
                <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:16,padding:'48px 24px',textAlign:'center',color:MUTED}}>
                  <Users size={32} style={{margin:'0 auto 10px',display:'block',opacity:0.25}}/>
                  <p style={{margin:0,fontSize:14,fontWeight:600,color:TEXT}}>Select an agent</p>
                  <p style={{margin:'4px 0 0',fontSize:13}}>Choose an agent from the left to view their report.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
