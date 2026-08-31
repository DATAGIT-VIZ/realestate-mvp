'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  PaperPlaneTilt,
  Plus,
  Trash,
  ChatTeardrop,
  ArrowClockwise,
  Microphone,
  MicrophoneSlash,
  BookmarkSimple,
  Copy,
  Check,
  MagnifyingGlass,
  ArrowRight,
  ChartLineUp,
  Lightning,
  Target,
  Brain,
  Buildings,
  CircleNotch,
  Star,
  Coins,
  Notepad,
  WhatsappLogo,
  Envelope,
} from '@phosphor-icons/react'
import type { AdvisorContext, LiveLead, LiveDeal } from '@/app/api/ai-assistant/route'
import type { CRMLead } from '@/lib/twenty'
import { PageTabBar } from '@/components/layout/PageTabBar'

const ADVISOR_TABS = [
  { label: 'AI Chat',    href: '/dashboard/advisor' },
  { label: 'Workflows',  href: '/dashboard/advisor/workflows' },
]

// ─── Design tokens — matches dashboard light palette ──────────────────────────
const C = {
  bg:          '#F5F6FA',
  panel:       '#FFFFFF',
  panelHov:    '#F8FAFC',
  border:      '#E8ECF0',
  borderMid:   '#D1D9E0',
  text:        '#263238',
  muted:       '#78889B',
  label:       '#A4B1BE',

  blue:        '#1D4ED8',
  blueDim:     'rgba(29,78,216,0.08)',
  blueBorder:  'rgba(29,78,216,0.22)',
  blueGrad:    'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)',

  emerald:     '#059669',
  emeraldDim:  'rgba(5,150,105,0.08)',
  amber:       '#F59E0B',
  amberDim:    'rgba(245,158,11,0.08)',
  red:         '#EF4444',
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage  { role: 'user' | 'assistant'; content: string; tokens?: number }
interface Conversation { id: string; title: string; messages: ChatMessage[]; createdAt: number; totalTokens: number }
interface SavedTemplate { id: string; content: string; savedAt: number }

const STORAGE_KEY   = 'ai_advisor_v5'
const TEMPLATES_KEY = 'ai_advisor_templates_v1'
const MAX_CONVOS    = 20

function genId()               { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function shortTitle(s: string) { return s.length > 44 ? s.slice(0, 44) + '…' : s }
function fmt(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}
function estimateTokens(text: string) { return Math.ceil(text.length / 4) }
function getCsId(lead: CRMLead): string {
  if (lead.leadPortalId?.startsWith('CS')) return lead.leadPortalId
  const hex = lead.id.replace(/-/g, '')
  let n = 0
  for (const c of hex) n = (n * 31 + parseInt(c, 16)) % 100000
  return `CS${String(n).padStart(5, '0')}`
}

// ─── Quick prompt categories ──────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'scripts', label: 'Write Scripts', Icon: Notepad, color: C.emerald, colorDim: C.emeraldDim,
    prompts: [
      'Write a WhatsApp follow-up for my top-scoring lead',
      'Give me an opening call script for a new inbound lead',
      'Draft a site visit confirmation message I can send now',
      'Write a "checking in" nudge for a lead who went silent',
    ],
  },
  {
    id: 'objections', label: 'Handle Objections', Icon: Lightning, color: C.amber, colorDim: C.amberDim,
    prompts: [
      'How do I respond when a buyer says "price is too high"?',
      "My client said \"I'll think about it\" — what do I say?",
      'Buyer wants a 10% discount — how do I counter?',
      'Their loan got rejected — how do I keep the deal alive?',
    ],
  },
  {
    id: 'pipeline', label: 'Pipeline Strategy', Icon: ChartLineUp, color: C.blue, colorDim: C.blueDim,
    prompts: [
      'Which lead should I call first today and why?',
      'Which deal in my pipeline is closest to closing?',
      'How do I move a lead from site visit to negotiation faster?',
      'I have 5 deals in negotiation — how do I prioritise?',
    ],
  },
  {
    id: 'market', label: 'Market Intel', Icon: Buildings, color: '#1D4ED8', colorDim: 'rgba(29,78,216,0.07)',
    prompts: [
      "What's buyer sentiment like in my focus cities right now?",
      'Which property type gives max commission this quarter?',
      'Give me 3 talking points: "why buy now, not later"',
      "What's happening in the ₹2–5Cr luxury segment?",
    ],
  },
]

const QUICK_FOLLOW_UPS = [
  { label: 'Write WhatsApp', prompt: 'Now write a ready-to-send WhatsApp message for this' },
  { label: 'Call script',    prompt: 'Give me a ready-to-use call script for this situation' },
  { label: "What's next?",   prompt: 'What should I do immediately after this? Give me one clear action.' },
]

// ─── Markdown renderer ────────────────────────────────────────────────────────
function MsgContent({ content, showCursor }: { content: string; showCursor?: boolean }) {
  const [copied, setCopied] = useState<number | null>(null)
  let codeIdx = 0
  const copyBlock = (code: string, i: number) => {
    navigator.clipboard.writeText(code); setCopied(i); setTimeout(() => setCopied(null), 2000)
  }
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.75, wordBreak: 'break-word' }}>
      {parts.map((part, pi) => {
        if (part.startsWith('```')) {
          const ci   = codeIdx++
          const code = part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim()
          return (
            <div key={pi} style={{ position: 'relative', margin: '10px 0' }}>
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}`, borderRadius: 6, padding: '12px 44px 12px 14px', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{code}</div>
              <button onClick={() => copyBlock(code, ci)} style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.panel, color: copied === ci ? C.emerald : C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {copied === ci ? <><Check size={10} weight="light" /> Copied</> : <><Copy size={10} weight="light" /> Copy</>}
              </button>
            </div>
          )
        }
        const lines = part.split('\n')
        return (
          <div key={pi}>
            {lines.map((line, li) => {
              if (line.startsWith('### ')) return <p key={li} style={{ fontWeight: 700, color: C.blue, margin: '10px 0 4px', fontSize: 13 }}>{line.slice(4)}</p>
              if (line.startsWith('## '))  return <p key={li} style={{ fontWeight: 700, color: C.text, margin: '12px 0 5px', fontSize: 14 }}>{line.slice(3)}</p>
              if (line.startsWith('# '))   return <p key={li} style={{ fontWeight: 700, color: C.text, margin: '14px 0 6px', fontSize: 15 }}>{line.slice(2)}</p>
              if (line.startsWith('---'))  return <hr key={li} style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />
              if (line.startsWith('- ') || line.startsWith('• '))
                return <div key={li} style={{ display: 'flex', gap: 8, margin: '3px 0', alignItems: 'flex-start' }}>
                  <span style={{ color: C.blue, flexShrink: 0, marginTop: 7, fontSize: 5 }}>●</span>
                  <span>{renderInline(line.slice(2))}</span>
                </div>
              if (/^\d+\.\s/.test(line))
                return <div key={li} style={{ display: 'flex', gap: 8, margin: '3px 0' }}>
                  <span style={{ color: C.blue, fontWeight: 600, fontSize: 12, flexShrink: 0, minWidth: 16 }}>{line.match(/^\d+/)![0]}.</span>
                  <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
                </div>
              if (line.trim() === '') return <div key={li} style={{ height: 5 }} />
              const isLast = pi === parts.length - 1 && li === lines.length - 1
              return <p key={li} style={{ margin: '2px 0' }}>{renderInline(line)}{isLast && showCursor && <StreamingCursor />}</p>
            })}
          </div>
        )
      })}
    </div>
  )
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return <>{parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i} style={{ color: C.text, fontWeight: 600 }}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)}</>
}

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '3px 2px', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: C.muted, marginRight: 2 }}>Thinking</span>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: C.blue, animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  )
}

function StreamingCursor() {
  return <span style={{ display: 'inline-block', width: 1.5, height: '1.1em', background: C.blue, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 0.9s step-end infinite', borderRadius: 1 }} />
}

// ─── Left panel: live context + lead search ───────────────────────────────────
function LivePanel({ ctx, allLeads, onLeadClick, onDealClick, ctxLoading, onRefresh }: {
  ctx: AdvisorContext | null
  allLeads: CRMLead[]
  onLeadClick: (l: LiveLead) => void
  onDealClick: (d: LiveDeal) => void
  ctxLoading: boolean
  onRefresh: () => void
}) {
  const [tab,    setTab]    = useState<'leads' | 'deals'>('leads')
  const [search, setSearch] = useState('')

  const displayLeads: LiveLead[] = search.trim()
    ? allLeads
        .filter(l => {
          const q    = search.toLowerCase()
          const name = `${l.name.firstName} ${l.name.lastName}`.toLowerCase()
          const phone = l.phones.primaryPhoneNumber ?? ''
          const csId  = getCsId(l).toLowerCase()
          return name.includes(q) || phone.includes(q) || csId.includes(q)
        })
        .slice(0, 8)
        .map(l => ({
          csId:  getCsId(l),
          name:  `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unknown',
          phone: l.phones.primaryPhoneNumber ?? '',
          city:  l.city ?? '',
          propertyType: l.propertyType?.[0] ?? '',
          score: l.intentScore ?? 0,
          stage: l.status ?? '',
          source: l.sourcePortal ?? '',
        }))
    : (ctx?.hotLeads ?? []).slice(0, 6)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '5px 0', fontSize: 10.5, fontWeight: 700, border: 'none', cursor: 'pointer',
    background: active ? C.blueGrad : 'transparent',
    color: active ? '#fff' : C.muted,
    borderRadius: 6, transition: 'all 0.12s', fontFamily: 'inherit',
  })

  return (
    <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>

      {/* Stats grid */}
      {ctxLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 10px', color: C.muted, fontSize: 12 }}>
          <CircleNotch size={12} weight="light" style={{ animation: 'spin 1s linear infinite' }} /> Loading pipeline…
        </div>
      ) : ctx ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
          {[
            { label: 'Hot leads',  value: String(ctx.hotLeadsCount), color: C.amber   },
            { label: 'Pipeline',   value: ctx.pipelineValue,         color: C.blue    },
            { label: 'Win rate',   value: `${ctx.winRate}%`,         color: C.emerald },
            { label: 'Avg score',  value: `${ctx.avgScore}/100`,     color: C.muted   },
          ].map(s => (
            <div key={s.label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 9px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9.5, color: C.label, marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 9px', marginBottom: 8 }}>
        <MagnifyingGlass size={12} weight="light" color={C.label} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search leads by name, CS ID…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, color: C.text, fontFamily: 'inherit' }}
        />
      </div>

      {/* Tabs */}
      {!search.trim() && ctx && (
        <div style={{ display: 'flex', gap: 3, background: C.bg, borderRadius: 8, padding: 3, marginBottom: 8 }}>
          <button style={tabStyle(tab === 'leads')} onClick={() => setTab('leads')}>Hot Leads</button>
          <button style={tabStyle(tab === 'deals')} onClick={() => setTab('deals')}>Deals</button>
        </div>
      )}

      {/* Lead list */}
      {(search.trim() || tab === 'leads') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {displayLeads.map((l, i) => (
            <button key={i} onClick={() => onLeadClick(l)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.blueDim; e.currentTarget.style.borderColor = C.blueBorder }}
              onMouseLeave={e => { e.currentTarget.style.background = C.panel; e.currentTarget.style.borderColor = C.border }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: C.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: C.blue }}>{l.name.charAt(0)}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                <div style={{ fontSize: 9.5, color: C.muted }}>{l.csId} · {l.city || 'Unknown'}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: l.score >= 70 ? C.emerald : l.score >= 40 ? C.amber : C.label, flexShrink: 0 }}>{l.score}</span>
            </button>
          ))}
          {displayLeads.length === 0 && (
            <p style={{ fontSize: 11.5, color: C.muted, textAlign: 'center', padding: '6px 0' }}>
              {search ? 'No leads found' : 'No hot leads yet'}
            </p>
          )}
        </div>
      )}

      {/* Deal list */}
      {!search.trim() && tab === 'deals' && ctx && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(ctx.dealsNearClose.length > 0 ? ctx.dealsNearClose : ctx.activeDeals).slice(0, 5).map((d, i) => (
            <button key={i} onClick={() => onDealClick(d)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.blueDim; e.currentTarget.style.borderColor = C.blueBorder }}
              onMouseLeave={e => { e.currentTarget.style.background = C.panel; e.currentTarget.style.borderColor = C.border }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: C.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Target size={12} weight="light" color={C.blue} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.leadName}</div>
                <div style={{ fontSize: 9.5, color: C.muted }}>{d.value} · {d.stage}</div>
              </div>
              <ArrowRight size={11} weight="light" color={C.label} style={{ flexShrink: 0 }} />
            </button>
          ))}
          {ctx.dealsNearClose.length === 0 && ctx.activeDeals.length === 0 && (
            <p style={{ fontSize: 11.5, color: C.muted, textAlign: 'center', padding: '6px 0' }}>No active deals</p>
          )}
        </div>
      )}

      <button onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: C.label, fontSize: 10.5, padding: '2px 0', fontFamily: 'inherit' }}>
        <ArrowClockwise size={10} weight="light" /> Refresh
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdvisorPage() {
  const [convos,      setConvos]      = useState<Conversation[]>([])
  const [activeId,    setActiveId]    = useState<string | null>(null)
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [streaming,   setStreaming]   = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [ctx,         setCtx]         = useState<AdvisorContext | null>(null)
  const [allLeads,    setAllLeads]    = useState<CRMLead[]>([])
  const [ctxLoading,  setCtxLoading]  = useState(true)
  const [activeCat,   setActiveCat]   = useState(0)
  const [templates,   setTemplates]   = useState<SavedTemplate[]>([])
  const [savedIdx,    setSavedIdx]    = useState<number | null>(null)
  const [copiedIdx,   setCopiedIdx]   = useState<number | null>(null)
  const [wasentIdx,   setWasentIdx]   = useState<number | null>(null)
  const [emailSentIdx, setEmailSentIdx] = useState<number | null>(null)
  const [listening,   setListening]   = useState(false)

  // Drag-to-resize
  const [leftW,    setLeftW]    = useState(272)
  const dragging   = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(0)

  const endRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null)

  // Load persisted data
  useEffect(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) { const p: Conversation[] = JSON.parse(s); setConvos(p); if (p.length) setActiveId(p[0].id) } } catch { /**/ }
    try { const t = localStorage.getItem(TEMPLATES_KEY); if (t) setTemplates(JSON.parse(t)) } catch { /**/ }
  }, [])
  useEffect(() => { if (convos.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, MAX_CONVOS))) }, [convos])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [convos, loading])

  // Drag resize
  const onDragStart = (e: React.MouseEvent) => {
    dragging.current = true; dragStartX.current = e.clientX; dragStartW.current = leftW
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      setLeftW(Math.max(220, Math.min(400, dragStartW.current + e.clientX - dragStartX.current)))
    }
    const onUp = () => { dragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = '' }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',  onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Load pipeline context
  const loadCtx = useCallback(async () => {
    setCtxLoading(true)
    try {
      type DealRow = { stage: string; deal_value: number; lead_name: string; city: string; assigned_to: string; expected_close?: string; source_portal?: string }
      const [lr, dr] = await Promise.all([
        fetch('/api/crm/leads?limit=200').then(r => r.json()),
        fetch('/api/deals').then(r => r.json()),
      ])
      const leads: CRMLead[]  = lr.data?.leads ?? lr.data ?? []
      const deals: DealRow[]  = dr.data ?? []
      setAllLeads(leads)

      const sorted = [...leads].sort((a, b) => (b.intentScore ?? 0) - (a.intentScore ?? 0))
      const hot    = sorted.filter(l => (l.intentScore ?? 0) >= 50)
      const hotLeads: LiveLead[] = sorted.map(l => ({
        csId:  getCsId(l),
        name:  `${l.name?.firstName ?? ''} ${l.name?.lastName ?? ''}`.trim() || 'Unknown',
        phone: l.phones?.primaryPhoneNumber ?? '',
        city:  l.city ?? '',
        propertyType: l.propertyType?.[0] ?? '',
        score: l.intentScore ?? 0,
        stage: l.status ?? '',
        source: l.sourcePortal ?? '',
        budget: l.budgetMin || l.budgetMax
          ? [
              l.budgetMin && `₹${l.budgetMin >= 10_000_000 ? (l.budgetMin/10_000_000).toFixed(1)+'Cr' : (l.budgetMin/100_000).toFixed(0)+'L'}`,
              l.budgetMax && `₹${l.budgetMax >= 10_000_000 ? (l.budgetMax/10_000_000).toFixed(1)+'Cr' : (l.budgetMax/100_000).toFixed(0)+'L'}`,
            ].filter(Boolean).join('–')
          : undefined,
      }))

      const active = deals.filter(d => !['won', 'lost'].includes(d.stage))
      const activeDeals: LiveDeal[] = active.map(d => ({
        leadName: d.lead_name, value: fmt(d.deal_value), rawValue: d.deal_value,
        stage: d.stage, city: d.city, agent: d.assigned_to,
        expectedClose: d.expected_close, sourcePortal: d.source_portal,
      }))
      const nearClose = active
        .filter(d => ['negotiation', 'token_paid'].includes(d.stage))
        .sort((a, b) => {
          const da = a.expected_close ? new Date(a.expected_close).getTime() : Infinity
          const db = b.expected_close ? new Date(b.expected_close).getTime() : Infinity
          return da - db
        })
        .slice(0, 6)
        .map(d => ({ leadName: d.lead_name, value: fmt(d.deal_value), rawValue: d.deal_value, stage: d.stage, city: d.city, agent: d.assigned_to, expectedClose: d.expected_close }))

      const won   = deals.filter(d => d.stage === 'won').length
      const total = deals.filter(d => ['won', 'lost'].includes(d.stage)).length
      const scores = leads.map(l => l.intentScore ?? 0).filter(Boolean)
      const pipelineVal = active.reduce((s, d) => s + d.deal_value, 0)
      const portalCounts: Record<string, number> = {}
      for (const l of leads) { if (l.sourcePortal) portalCounts[l.sourcePortal] = (portalCounts[l.sourcePortal] ?? 0) + 1 }

      setCtx({
        totalLeads: leads.length, hotLeadsCount: hot.length,
        avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        responseRate: 72, topSource: Object.entries(portalCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'Unknown',
        hotLeads, activeDeals, pipelineValue: fmt(pipelineVal),
        winRate: total ? Math.round((won / total) * 100) : 0,
        dealsNearClose: nearClose, recentPortalCounts: portalCounts,
      })
    } catch { /**/ } finally { setCtxLoading(false) }
  }, [])
  useEffect(() => { loadCtx() }, [loadCtx])

  const active      = convos.find(c => c.id === activeId) ?? null
  const totalTokens = active?.totalTokens ?? 0

  const newConvo = useCallback(() => {
    const c: Conversation = { id: genId(), title: 'New conversation', messages: [], createdAt: Date.now(), totalTokens: 0 }
    setConvos(p => [c, ...p]); setActiveId(c.id); setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const delConvo = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConvos(p => { const next = p.filter(c => c.id !== id); if (activeId === id) setActiveId(next[0]?.id ?? null); return next })
  }, [activeId])

  const injectLead = useCallback((l: LiveLead) => {
    setInput(`What should I do with ${l.name} — ${l.propertyType || 'property'} in ${l.city || 'unknown city'}, score ${l.score}/100, currently ${l.stage || 'new'} stage?`)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const injectDeal = useCallback((d: LiveDeal) => {
    setInput(`What's the best next step to close the deal with ${d.leadName}? They're at ${d.stage} stage, ${d.value} deal in ${d.city}.`)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const saveTemplate = useCallback((content: string, idx: number) => {
    const t: SavedTemplate = { id: genId(), content: content.slice(0, 2000), savedAt: Date.now() }
    setTemplates(prev => {
      const next = [t, ...prev].slice(0, 50)
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next))
      return next
    })
    setSavedIdx(idx); setTimeout(() => setSavedIdx(null), 2000)
  }, [])

  const copyMessage = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content)
    setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000)
  }, [])

  const sendViaWhatsApp = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content)
    setWasentIdx(idx); setTimeout(() => setWasentIdx(null), 2000)
  }, [])

  const sendViaEmail = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content)
    setEmailSentIdx(idx); setTimeout(() => setEmailSentIdx(null), 2000)
  }, [])

  const toggleVoice = useCallback(() => {
    if (listening) { recogRef.current?.stop(); setListening(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice input requires Chrome or Edge.'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR()
    r.lang = 'en-IN'; r.continuous = false; r.interimResults = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      setInput(Array.from(e.results).map((res: any) => res[0].transcript).join(''))
    }
    r.onend  = () => setListening(false)
    r.onerror = () => setListening(false)
    r.start(); recogRef.current = r; setListening(true)
  }, [listening])

  const regenerate = useCallback(async () => {
    if (!active || active.messages.length < 2 || loading) return
    const msgs     = active.messages
    const lastUser = [...msgs].reverse().find(m => m.role === 'user')
    if (!lastUser) return
    const lastUserIdx = msgs.lastIndexOf(lastUser)
    const trimmed     = msgs.slice(0, lastUserIdx)
    const cid         = activeId!
    setConvos(p => p.map(c => c.id !== cid ? c : { ...c, messages: [...trimmed, lastUser, { role: 'assistant', content: '' }] }))
    setLoading(true); setStreamingId(cid)
    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...trimmed, lastUser], context: ctx }),
      })
      if (!res.ok || !res.body) throw new Error('Request failed')
      setStreaming(true)
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let acc = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        acc += decoder.decode(value, { stream: true })
        setConvos(p => p.map(c => { if (c.id !== cid) return c; const ms = [...c.messages]; ms[ms.length - 1] = { role: 'assistant', content: acc }; return { ...c, messages: ms } }))
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
      setConvos(p => p.map(c => { if (c.id !== cid) return c; const ms = [...c.messages]; ms[ms.length - 1] = { role: 'assistant', content: acc, tokens: estimateTokens(acc) }; return { ...c, messages: ms } }))
    } catch { /**/ } finally { setLoading(false); setStreaming(false); setStreamingId(null) }
  }, [active, activeId, loading, ctx])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: text.trim(), tokens: estimateTokens(text.trim()) }
    let cid = activeId
    if (!cid) {
      const c: Conversation = { id: genId(), title: shortTitle(text.trim()), messages: [], createdAt: Date.now(), totalTokens: 0 }
      setConvos(p => [c, ...p]); setActiveId(c.id); cid = c.id
    }
    setConvos(p => p.map(c => c.id !== cid ? c : {
      ...c,
      title: c.messages.length === 0 ? shortTitle(text.trim()) : c.title,
      messages: [...c.messages, userMsg, { role: 'assistant', content: '' }],
    }))
    setInput(''); setLoading(true); setStreamingId(cid)
    const prev = convos.find(c => c.id === cid)?.messages ?? []
    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...prev, userMsg], context: ctx }),
      })
      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(errJson.error ?? 'Request failed')
      }
      setStreaming(true)
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let acc = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        acc += decoder.decode(value, { stream: true })
        setConvos(p => p.map(c => { if (c.id !== cid) return c; const ms = [...c.messages]; ms[ms.length - 1] = { role: 'assistant', content: acc }; return { ...c, messages: ms } }))
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
      const rTokens = estimateTokens(acc)
      setConvos(p => p.map(c => { if (c.id !== cid) return c; const ms = [...c.messages]; ms[ms.length - 1] = { role: 'assistant', content: acc, tokens: rTokens }; return { ...c, messages: ms, totalTokens: (c.totalTokens ?? 0) + (userMsg.tokens ?? 0) + rTokens } }))
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Connection failed.'
      setConvos(p => p.map(c => { if (c.id !== cid) return c; const ms = [...c.messages]; ms[ms.length - 1] = { role: 'assistant', content: `Failed — ${errMsg}` }; return { ...c, messages: ms } }))
    } finally { setLoading(false); setStreaming(false); setStreamingId(null) }
  }, [loading, activeId, convos, ctx])

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const cat = CATEGORIES[activeCat]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: C.bg, overflow: 'hidden' }}>
      <PageTabBar tabs={ADVISOR_TABS} />
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <div style={{ width: leftW, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: C.panel, flexShrink: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: `linear-gradient(135deg, ${C.blueDim} 0%, rgba(59,130,246,0.03) 100%)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: C.blueGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Brain size={17} weight="light" color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>AI Business Advisor</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.emerald }} />
                <span style={{ fontSize: 9.5, color: C.emerald, fontWeight: 600 }}>Live pipeline connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          <LivePanel
            ctx={ctx}
            allLeads={allLeads}
            onLeadClick={injectLead}
            onDealClick={injectDeal}
            ctxLoading={ctxLoading}
            onRefresh={loadCtx}
          />

          {/* Conversation history */}
          <div style={{ padding: '10px 10px 6px', flex: 1 }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px 2px' }}>Conversations</p>
            {convos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                <ChatTeardrop size={18} weight="light" color={C.border} style={{ margin: '0 auto 5px', display: 'block' }} />
                <p style={{ fontSize: 11, color: C.label, margin: 0 }}>No chats yet</p>
              </div>
            ) : convos.map(c => (
              <div key={c.id} onClick={() => setActiveId(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', borderRadius: 8, cursor: 'pointer', marginBottom: 2, background: c.id === activeId ? C.blueDim : 'transparent', border: `1px solid ${c.id === activeId ? C.blueBorder : 'transparent'}`, transition: 'all 0.12s' }}
                onMouseEnter={e => { if (c.id !== activeId) e.currentTarget.style.background = C.panelHov }}
                onMouseLeave={e => { if (c.id !== activeId) e.currentTarget.style.background = 'transparent' }}>
                <ChatTeardrop size={12} weight="light" color={c.id === activeId ? C.blue : C.label} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: c.id === activeId ? C.blue : C.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: c.id === activeId ? 600 : 400 }}>{c.title}</span>
                <button onClick={e => delConvo(c.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.label, padding: 2, opacity: 0.5, flexShrink: 0, fontFamily: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.red)} onMouseLeave={e => (e.currentTarget.style.color = C.label)}>
                  <Trash size={11} weight="light" />
                </button>
              </div>
            ))}
          </div>

          {/* Saved templates */}
          {templates.length > 0 && (
            <div style={{ padding: '8px 10px 10px', borderTop: `1px solid ${C.border}` }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px 2px' }}>Saved Scripts</p>
              {templates.slice(0, 3).map(t => (
                <div key={t.id}
                  onClick={() => setInput(t.content)}
                  style={{ padding: '6px 9px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, marginBottom: 3, cursor: 'pointer', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.blueBorder; e.currentTarget.style.background = C.blueDim }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg }}>
                  <p style={{ margin: 0, fontSize: 10.5, color: C.muted, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{t.content.slice(0, 80)}…</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New chat */}
        <div style={{ padding: '10px 12px 14px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={newConvo} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, background: C.blueGrad, border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em', boxShadow: '0 2px 8px rgba(29,78,216,0.2)' }}>
            <Plus size={13} weight="light" /> New Conversation
          </button>
        </div>
      </div>

      {/* ── Drag handle ──────────────────────────────────────────────────── */}
      <div
        onMouseDown={onDragStart}
        style={{ width: 3, flexShrink: 0, cursor: 'col-resize', background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = C.blueBorder)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      />

      {/* ── Main chat area ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.bg }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{active?.title ?? 'AI Business Advisor'}</div>
            {ctx && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{ctx.hotLeadsCount} hot leads · {ctx.pipelineValue} pipeline</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {totalTokens > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: C.bg, border: `1px solid ${C.border}` }}>
                <Coins size={11} weight="light" color={C.muted} />
                <span style={{ fontSize: 10.5, color: C.muted }}>~{totalTokens.toLocaleString()} tokens</span>
              </div>
            )}
            {ctx && (
              <span style={{ fontSize: 10.5, color: C.emerald, background: C.emeraldDim, border: '1px solid rgba(5,150,105,0.2)', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
                ● Live
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}>

          {/* Empty state */}
          {(!active || active.messages.length === 0) && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, maxWidth: 700, margin: '0 auto', width: '100%', padding: '24px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: C.blueGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: '0 8px 24px rgba(29,78,216,0.2)' }}>
                  <Brain size={30} weight="light" color="#fff" />
                </div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: '0 0 10px', letterSpacing: '-0.03em' }}>
                  What can I help with?
                </h2>
                <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.65 }}>
                  I know your pipeline, your leads by name, and the Indian market.<br />
                  Ask anything — scripts, strategy, objections, specific next steps.
                </p>
              </div>

              {/* Category tabs */}
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {CATEGORIES.map((c, i) => {
                    const Icon = c.Icon
                    const sel  = activeCat === i
                    return (
                      <button key={i} onClick={() => setActiveCat(i)} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
                        borderRadius: 24, border: `1.5px solid ${sel ? c.color : C.border}`,
                        background: sel ? c.colorDim : C.panel,
                        color: sel ? c.color : C.muted, fontSize: 12.5, fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                        boxShadow: sel ? `0 2px 8px ${c.color}20` : 'none',
                      }}>
                        <Icon size={13} weight="light" />
                        {c.label}
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {cat.prompts.map((p, i) => (
                    <button key={i} onClick={() => send(p)} style={{
                      padding: '14px 17px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', lineHeight: 1.55,
                      background: C.panel, border: `1.5px solid ${C.border}`,
                      color: C.text, fontSize: 13, transition: 'all 0.15s', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.background = cat.colorDim; e.currentTarget.style.boxShadow = `0 4px 12px ${cat.color}18` }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.panel; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <span>{p}</span>
                      <ArrowRight size={13} weight="light" color={C.label} style={{ flexShrink: 0, marginTop: 2 }} />
                    </button>
                  ))}
                </div>
              </div>

              {ctx && ctx.hotLeads.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: C.blueDim, border: `1px solid ${C.blueBorder}`, borderRadius: 10 }}>
                  <Star size={13} weight="light" color={C.blue} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12.5, color: C.blue, margin: 0 }}>
                    <strong>Tip:</strong> Click any lead or deal in the left panel to ask about them directly.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Message thread */}
          {active?.messages.map((msg, i) => {
            const isUser      = msg.role === 'user'
            const isLastMsg   = i === (active.messages.length - 1)
            const isStreaming  = !isUser && streaming && streamingId === activeId && isLastMsg
            const isThinking   = !isUser && msg.content === '' && loading
            const isLastAI     = !isUser && isLastMsg && !loading && msg.content
            const prevUserMsg  = !isUser && i > 0 ? (active.messages.slice(0, i).reverse().find(m => m.role === 'user')?.content ?? '') : ''
            const isDraft      = !isUser && !isThinking && msg.content && (
              /^(Hi|Hello|Dear|Namaste|Hey)\b/i.test(msg.content.trim()) ||
              /write|draft|whatsapp|email|message|script|follow[-\s]?up|send/i.test(prevUserMsg)
            )

            return (
              <div key={i} style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start', maxWidth: 840, width: '100%', alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
                {!isUser && (
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: C.blueGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, boxShadow: '0 2px 8px rgba(29,78,216,0.2)' }}>
                    <Brain size={14} weight="light" color="#fff" />
                  </div>
                )}
                <div style={{ flex: isUser ? 'none' : 1, maxWidth: isUser ? '68%' : undefined }}>
                  {isUser ? (
                    <div style={{ background: C.blueGrad, borderRadius: '18px 4px 18px 18px', padding: '11px 16px', boxShadow: '0 2px 8px rgba(29,78,216,0.2)' }}>
                      <p style={{ margin: 0, fontSize: 13.5, color: '#fff', lineHeight: 1.6 }}>{msg.content}</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ background: C.panel, borderLeft: `3px solid ${C.blue}`, borderRadius: '0 12px 12px 12px', padding: '13px 17px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                        {isThinking ? <ThinkingDots /> : <MsgContent content={msg.content} showCursor={isStreaming} />}
                      </div>

                      {/* Message action bar */}
                      {!isThinking && msg.content && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 5, paddingLeft: 2, flexWrap: 'wrap' }}>
                          {isDraft && (
                            <>
                              <button
                                onClick={() => sendViaWhatsApp(msg.content, i)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: `1px solid ${wasentIdx === i ? 'rgba(37,211,102,0.35)' : 'transparent'}`, background: wasentIdx === i ? 'rgba(37,211,102,0.08)' : 'transparent', color: '#25D366', fontSize: 10.5, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(37,211,102,0.35)'; e.currentTarget.style.background = 'rgba(37,211,102,0.08)' }}
                                onMouseLeave={e => { if (wasentIdx !== i) { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' } }}>
                                {wasentIdx === i ? <Check size={11} weight="light" /> : <WhatsappLogo size={11} weight="light" />}
                                {wasentIdx === i ? 'Copied for WhatsApp' : 'Send via WhatsApp'}
                              </button>
                              <button
                                onClick={() => sendViaEmail(msg.content, i)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: `1px solid ${emailSentIdx === i ? C.blueBorder : 'transparent'}`, background: emailSentIdx === i ? C.blueDim : 'transparent', color: emailSentIdx === i ? C.blue : C.blue, fontSize: 10.5, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = C.blueBorder; e.currentTarget.style.background = C.blueDim }}
                                onMouseLeave={e => { if (emailSentIdx !== i) { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' } }}>
                                {emailSentIdx === i ? <Check size={11} weight="light" /> : <Envelope size={11} weight="light" />}
                                {emailSentIdx === i ? 'Copied for Email' : 'Send Email'}
                              </button>
                              <div style={{ width: 1, height: 14, background: C.border, margin: '0 2px' }} />
                            </>
                          )}
                          <button
                            onClick={() => copyMessage(msg.content, i)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: copiedIdx === i ? C.emerald : C.label, fontSize: 10.5, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.panel }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}>
                            {copiedIdx === i ? <Check size={11} weight="light" /> : <Copy size={11} weight="light" />}
                            {copiedIdx === i ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            onClick={() => saveTemplate(msg.content, i)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: savedIdx === i ? C.blue : C.label, fontSize: 10.5, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.panel }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}>
                            <BookmarkSimple size={11} weight="light" />
                            {savedIdx === i ? 'Saved!' : 'Save'}
                          </button>
                          {isLastAI && (
                            <button
                              onClick={regenerate}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: C.label, fontSize: 10.5, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.panel }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}>
                              <ArrowClockwise size={11} weight="light" />
                              Retry
                            </button>
                          )}
                        </div>
                      )}

                      {/* Quick follow-up chips */}
                      {isLastAI && active.messages.length >= 2 && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', paddingLeft: 2 }}>
                          {QUICK_FOLLOW_UPS.map((q, qi) => (
                            <button key={qi} onClick={() => send(q.prompt)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.panel, color: C.muted, fontSize: 11.5, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = C.blueBorder; e.currentTarget.style.color = C.blue; e.currentTarget.style.background = C.blueDim }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; e.currentTarget.style.background = C.panel }}>
                              <Lightning size={11} weight="light" />
                              {q.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: '10px 20px 14px', background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: '#FFFBF8', border: `1.5px solid ${C.blueBorder}`, borderRadius: 16, padding: '8px 8px 8px 14px', maxWidth: 800, margin: '0 auto', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onFocusCapture={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.blueDim}` }}
            onBlurCapture={e  => { e.currentTarget.style.borderColor = C.blueBorder; e.currentTarget.style.boxShadow = 'none' }}>

            {/* Voice button */}
            <button
              onClick={toggleVoice}
              title={listening ? 'Stop recording' : 'Voice input (en-IN)'}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${listening ? C.red : C.border}`, background: listening ? 'rgba(239,68,68,0.08)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}>
              {listening
                ? <MicrophoneSlash size={14} weight="light" color={C.red} />
                : <Microphone size={14} weight="light" color={C.label} />
              }
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={ctx?.hotLeads[0] ? `Ask about ${ctx.hotLeads[0].name}, write a script, get market intel…` : 'Ask anything about your pipeline, clients, or market…'}
              rows={1}
              disabled={loading}
              style={{ flex: 1, background: 'transparent', border: 'none', color: C.text, fontSize: 13.5, resize: 'none', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.6, maxHeight: 120, overflow: 'auto' }}
            />

            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              style={{ width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0, background: input.trim() && !loading ? C.blueGrad : C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.15s', boxShadow: input.trim() && !loading ? '0 2px 8px rgba(29,78,216,0.3)' : 'none' }}>
              {loading
                ? <CircleNotch size={14} weight="light" color={C.muted} style={{ animation: 'spin 1s linear infinite' }} />
                : <PaperPlaneTilt size={14} weight="light" color={input.trim() ? '#fff' : C.label} />
              }
            </button>
          </div>
          <p style={{ fontSize: 11, color: C.label, textAlign: 'center', margin: '7px 0 0' }}>
            Lead Gap CRM AI · Live pipeline context · ↵ send · ⇧↵ newline
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-4px);opacity:1} }
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
    </div>
  )
}
