'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Bot, Send, Plus, Trash2, MessageSquare, User, Loader2,
  Sparkles, Copy, CheckCheck, Zap, Phone, MessageCircle,
  TrendingUp, Building2, RefreshCw, ChevronRight,
  Target, Coins, ArrowRight, Star,
} from 'lucide-react'
import type { AdvisorContext, LiveLead, LiveDeal } from '@/app/api/ai-assistant/route'
import type { CRMLead } from '@/lib/twenty'

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg:           '#F8FAFC',
  panel:        '#FFFFFF',
  border:       '#E2E8F0',
  borderDim:    '#F1F5F9',
  text:         '#0F172A',
  muted:        '#64748B',
  label:        '#94A3B8',
  blue:         '#a000c8',
  blueDim:      'rgba(160,0,200,0.07)',
  blueBorder:   'rgba(160,0,200,0.22)',
  amber:        '#be2ed6',
  amberDim:     'rgba(190,46,214,0.07)',
  amberBorder:  'rgba(190,46,214,0.25)',
  emerald:      '#059669',
  emeraldDim:   '#ECFDF5',
  violet:       '#a000c8',
  violetDim:    'rgba(160,0,200,0.07)',
  violetBorder: 'rgba(160,0,200,0.22)',
  purpleGrad:   'linear-gradient(135deg, #7600bc 0%, #b100cd 100%)',
  red:          '#EF4444',
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage { role: 'user' | 'assistant'; content: string; tokens?: number }
interface Conversation { id: string; title: string; messages: ChatMessage[]; createdAt: number; totalTokens: number }

const STORAGE_KEY = 'ai_advisor_v3'
const MAX_CONVOS  = 20

function genId()   { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function shortTitle(s: string) { return s.length > 44 ? s.slice(0, 44) + '…' : s }
function fmt(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}
// Rough token estimate: 1 token ≈ 4 chars
function estimateTokens(text: string) { return Math.ceil(text.length / 4) }
// Cost: Sonnet input $3/M, output $15/M tokens. Assume 70% input / 30% output split.
function estimateCostUSD(tokens: number) { return ((tokens * 0.7 * 3 + tokens * 0.3 * 15) / 1_000_000) }

function getCsId(lead: CRMLead): string {
  if (lead.leadPortalId?.startsWith('CS')) return lead.leadPortalId
  const hex = lead.id.replace(/-/g, '')
  let n = 0
  for (const c of hex) n = (n * 31 + parseInt(c, 16)) % 100000
  return `CS${String(n).padStart(5, '0')}`
}

// ─── Quick prompt categories ────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'scripts', label: 'Write Scripts', icon: MessageCircle, color: C.emerald, colorDim: C.emeraldDim,
    prompts: [
      'Write a WhatsApp follow-up for my top-scoring lead',
      'Give me an opening call script for a new inbound lead',
      'Draft a site visit confirmation message I can send now',
      'Write a "checking in" nudge for a lead who went silent',
    ],
  },
  {
    id: 'objections', label: 'Handle Objections', icon: Zap, color: C.amber, colorDim: C.amberDim,
    prompts: [
      'How do I respond when a buyer says "price is too high"?',
      'My client said "I\'ll think about it" — what do I say?',
      'Buyer wants a 10% discount — how do I counter?',
      'Their loan got rejected — how do I keep the deal alive?',
    ],
  },
  {
    id: 'pipeline', label: 'Pipeline Strategy', icon: TrendingUp, color: C.blue, colorDim: C.blueDim,
    prompts: [
      'Which lead should I call first today and why?',
      'Which deal in my pipeline is closest to closing?',
      'How do I move a lead from site visit to negotiation faster?',
      'I have 5 deals in negotiation — how do I prioritise?',
    ],
  },
  {
    id: 'market', label: 'Market Intel', icon: Building2, color: C.violet, colorDim: C.violetDim,
    prompts: [
      'What\'s buyer sentiment like in my focus cities right now?',
      'Which property type gives max commission this quarter?',
      'Give me 3 talking points: "why buy now, not later"',
      'What\'s happening in the ₹2–5Cr luxury segment?',
    ],
  },
]

// ─── Markdown renderer ────────────────────────────────────────────────────────
function MsgContent({ content, showCursor }: { content: string; showCursor?: boolean }) {
  const [copied, setCopied] = useState<number | null>(null)
  let codeIdx = 0

  const copyBlock = (code: string, i: number) => {
    navigator.clipboard.writeText(code)
    setCopied(i)
    setTimeout(() => setCopied(null), 2000)
  }

  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.75, wordBreak: 'break-word' }}>
      {parts.map((part, pi) => {
        if (part.startsWith('```')) {
          const ci = codeIdx++
          const code = part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim()
          return (
            <div key={pi} style={{ position: 'relative', margin: '12px 0' }}>
              <div style={{
                background: '#F8FAFC', border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${C.blue}`,
                borderRadius: 10, padding: '14px 48px 14px 16px',
                fontFamily: 'monospace', fontSize: 13, color: C.text,
                lineHeight: 1.7, whiteSpace: 'pre-wrap',
              }}>{code}</div>
              <button onClick={() => copyBlock(code, ci)} style={{
                position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 7, border: `1px solid ${C.border}`,
                background: C.panel, color: copied === ci ? C.emerald : C.muted,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                {copied === ci ? <><CheckCheck size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
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
              if (line.startsWith('# '))   return <p key={li} style={{ fontWeight: 800, color: C.text, margin: '14px 0 6px', fontSize: 15 }}>{line.slice(2)}</p>
              if (line.startsWith('---'))  return <hr key={li} style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />
              if (line.startsWith('- ') || line.startsWith('• '))
                return <div key={li} style={{ display: 'flex', gap: 8, margin: '3px 0', alignItems: 'flex-start' }}>
                  <span style={{ color: C.blue, flexShrink: 0, marginTop: 6, fontSize: 7 }}>●</span>
                  <span>{renderInline(line.slice(2))}</span>
                </div>
              if (/^\d+\.\s/.test(line))
                return <div key={li} style={{ display: 'flex', gap: 8, margin: '3px 0' }}>
                  <span style={{ color: C.blue, fontWeight: 700, fontSize: 12, flexShrink: 0, minWidth: 16 }}>{line.match(/^\d+/)![0]}.</span>
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
    <div style={{ display: 'flex', gap: 5, padding: '4px 2px', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: C.muted, marginRight: 2 }}>Thinking</span>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.violet, animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  )
}

function StreamingCursor() {
  return <span style={{ display: 'inline-block', width: 2, height: '1.1em', background: C.violet, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 0.9s step-end infinite', borderRadius: 1 }} />
}

// ─── Sidebar: live context panel ─────────────────────────────────────────────
function LivePanel({ ctx, onLeadClick, onDealClick, ctxLoading, onRefresh }: {
  ctx: AdvisorContext | null
  onLeadClick: (l: LiveLead) => void
  onDealClick: (d: LiveDeal) => void
  ctxLoading: boolean
  onRefresh: () => void
}) {
  const [tab, setTab] = useState<'leads' | 'deals'>('leads')
  const tabS = (a: boolean): React.CSSProperties => ({
    flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
    background: a ? C.blue : 'transparent', color: a ? '#fff' : C.muted,
    borderRadius: 7, transition: 'all 0.12s',
  })

  return (
    <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
      {/* Stats row */}
      {ctxLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 10px', color: C.muted, fontSize: 12 }}>
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading pipeline…
        </div>
      ) : ctx ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
          {[
            { label: 'Hot leads',  value: String(ctx.hotLeadsCount), color: C.amber  },
            { label: 'Pipeline',   value: ctx.pipelineValue,         color: C.blue   },
            { label: 'Win rate',   value: `${ctx.winRate}%`,         color: C.emerald},
            { label: 'Avg score',  value: `${ctx.avgScore}/100`,     color: C.violet },
          ].map(s => (
            <div key={s.label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.label, marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Tab switcher */}
      {ctx && (
        <>
          <div style={{ display: 'flex', gap: 3, background: C.bg, borderRadius: 9, padding: 3, marginBottom: 10 }}>
            <button style={tabS(tab === 'leads')} onClick={() => setTab('leads')}>Hot Leads</button>
            <button style={tabS(tab === 'deals')} onClick={() => setTab('deals')}>Deals</button>
          </div>

          {tab === 'leads' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ctx.hotLeads.slice(0, 6).map((l, i) => (
                <button key={i} onClick={() => onLeadClick(l)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.panel, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.blueDim; e.currentTarget.style.borderColor = C.blueBorder }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.panel; e.currentTarget.style.borderColor = C.border }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: C.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.blue }}>{l.name.charAt(0)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{l.city} · {l.propertyType}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: l.score >= 70 ? C.emerald : C.amber, background: l.score >= 70 ? C.emeraldDim : C.amberDim, borderRadius: 6, padding: '2px 6px', flexShrink: 0 }}>{l.score}</span>
                </button>
              ))}
              {ctx.hotLeads.length === 0 && <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '8px 0' }}>No hot leads yet</p>}
            </div>
          )}

          {tab === 'deals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ctx.dealsNearClose.slice(0, 5).map((d, i) => (
                <button key={i} onClick={() => onDealClick(d)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.panel, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.amberDim; e.currentTarget.style.borderColor = C.amberBorder }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.panel; e.currentTarget.style.borderColor = C.border }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: C.amberDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Target size={13} color={C.amber} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.leadName}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{d.value} · {d.stage}</div>
                  </div>
                  <ChevronRight size={12} color={C.label} style={{ flexShrink: 0 }} />
                </button>
              ))}
              {ctx.dealsNearClose.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ctx.activeDeals.slice(0, 4).map((d, i) => (
                    <button key={i} onClick={() => onDealClick(d)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.panel, cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.amberDim }}
                      onMouseLeave={e => { e.currentTarget.style.background = C.panel }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: C.amberDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Target size={13} color={C.amber} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.leadName}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{d.value} · {d.stage}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <button onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: C.label, fontSize: 11, padding: '2px 0' }}>
        <RefreshCw size={10} /> Refresh data
      </button>
    </div>
  )
}

// ─── Token badge ─────────────────────────────────────────────────────────────
function TokenBadge({ tokens }: { tokens: number }) {
  const costUSD = estimateCostUSD(tokens)
  const costINR = costUSD * 84
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: tokens > 5000 ? 'rgba(190,46,214,0.08)' : C.bg, border: `1px solid ${tokens > 5000 ? C.amberBorder : C.border}` }}>
      <Coins size={12} color={C.muted} />
      <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>~{tokens.toLocaleString()} tokens</span>
      <span style={{ fontSize: 10, color: C.label }}>≈ ₹{costINR.toFixed(2)}</span>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AdvisorPage() {
  const [convos,     setConvos]     = useState<Conversation[]>([])
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [streaming,  setStreaming]   = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [ctx,        setCtx]        = useState<AdvisorContext | null>(null)
  const [ctxLoading, setCtxLoading] = useState(true)
  const [activeCat,  setActiveCat]  = useState(0)
  const endRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Persist convos
  useEffect(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) { const p: Conversation[] = JSON.parse(s); setConvos(p); if (p.length) setActiveId(p[0].id) } } catch { /* ignore */ }
  }, [])
  useEffect(() => { if (convos.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, MAX_CONVOS))) }, [convos])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [convos, loading])

  // Fetch context
  const loadCtx = useCallback(async () => {
    setCtxLoading(true)
    try {
      type DealRow = { stage: string; deal_value: number; lead_name: string; city: string; assigned_to: string; expected_close?: string; source_portal?: string }
      const [lr, dr] = await Promise.all([
        fetch('/api/crm/leads?limit=200').then(r => r.json()),
        fetch('/api/deals').then(r => r.json()),
      ])
      const leads: CRMLead[] = lr.data?.leads ?? lr.data ?? []
      const deals: DealRow[] = dr.data ?? []

      // Sort ALL leads by score — AI needs to look up any CS ID, not just hot ones
      const allSorted = [...leads].sort((a, b) => (b.intentScore ?? 0) - (a.intentScore ?? 0))
      const hot = allSorted.filter(l => (l.intentScore ?? 0) >= 50)
      const hotLeads: LiveLead[] = allSorted.map(l => ({
        csId: getCsId(l),
        name: `${l.name?.firstName ?? ''} ${l.name?.lastName ?? ''}`.trim() || 'Unknown',
        phone: l.phones?.primaryPhoneNumber ?? '',
        city: l.city ?? '',
        propertyType: l.propertyType?.[0] ?? '',
        score: l.intentScore ?? 0,
        stage: l.status ?? '',
        source: l.sourcePortal ?? '',
        budget: l.budgetMin || l.budgetMax
          ? [l.budgetMin && `₹${l.budgetMin >= 10_000_000 ? (l.budgetMin/10_000_000).toFixed(1)+'Cr' : (l.budgetMin/100_000).toFixed(0)+'L'}`, l.budgetMax && `₹${l.budgetMax >= 10_000_000 ? (l.budgetMax/10_000_000).toFixed(1)+'Cr' : (l.budgetMax/100_000).toFixed(0)+'L'}`].filter(Boolean).join('–')
          : undefined,
      }))

      const active = deals.filter(d => !['won', 'lost'].includes(d.stage))
      const activeDeals: LiveDeal[] = active.map(d => ({ leadName: d.lead_name, value: fmt(d.deal_value), rawValue: d.deal_value, stage: d.stage, city: d.city, agent: d.assigned_to, expectedClose: d.expected_close, sourcePortal: d.source_portal }))

      const nearClose = active.filter(d => ['negotiation', 'token_paid'].includes(d.stage))
        .sort((a, b) => { const da = a.expected_close ? new Date(a.expected_close).getTime() : Infinity; const db = b.expected_close ? new Date(b.expected_close).getTime() : Infinity; return da - db })
        .slice(0, 6)
        .map(d => ({ leadName: d.lead_name, value: fmt(d.deal_value), rawValue: d.deal_value, stage: d.stage, city: d.city, agent: d.assigned_to, expectedClose: d.expected_close }))

      const won   = deals.filter(d => d.stage === 'won').length
      const total = deals.filter(d => ['won', 'lost'].includes(d.stage)).length
      const scores = leads.filter(l => l.intentScore).map(l => l.intentScore ?? 0)
      const pipelineVal = active.reduce((s, d) => s + d.deal_value, 0)
      const portalCounts: Record<string, number> = {}
      for (const l of leads) { const s = l.sourcePortal; if (s) portalCounts[s] = (portalCounts[s] ?? 0) + 1 }

      setCtx({
        totalLeads: leads.length, hotLeadsCount: hot.length,
        avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        responseRate: 72, topSource: Object.entries(portalCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'Unknown',
        hotLeads, activeDeals, pipelineValue: fmt(pipelineVal),
        winRate: total ? Math.round((won / total) * 100) : 0,
        dealsNearClose: nearClose, recentPortalCounts: portalCounts,
      })
    } catch { /* ignore */ } finally { setCtxLoading(false) }
  }, [])

  useEffect(() => { loadCtx() }, [loadCtx])

  const active = convos.find(c => c.id === activeId) ?? null
  const totalTokens = active?.totalTokens ?? 0

  const newConvo = useCallback(() => {
    const c: Conversation = { id: genId(), title: 'New conversation', messages: [], createdAt: Date.now(), totalTokens: 0 }
    setConvos(p => [c, ...p])
    setActiveId(c.id)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const delConvo = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConvos(p => { const next = p.filter(c => c.id !== id); if (activeId === id) setActiveId(next[0]?.id ?? null); return next })
  }, [activeId])

  const injectLead = useCallback((l: LiveLead) => {
    const msg = `What should I do with ${l.name} — ${l.propertyType} in ${l.city}, score ${l.score}/100, currently in ${l.stage || 'new'} stage?`
    setInput(msg)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const injectDeal = useCallback((d: LiveDeal) => {
    const msg = `What's the best next step to close the deal with ${d.leadName}? They're at ${d.stage} stage, ${d.value} deal in ${d.city}.`
    setInput(msg)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: text.trim(), tokens: estimateTokens(text.trim()) }

    let cid = activeId
    if (!cid) {
      const c: Conversation = { id: genId(), title: shortTitle(text.trim()), messages: [], createdAt: Date.now(), totalTokens: 0 }
      setConvos(p => [c, ...p])
      setActiveId(c.id)
      cid = c.id
    }

    setConvos(p => p.map(c => c.id !== cid ? c : {
      ...c,
      title: c.messages.length === 0 ? shortTitle(text.trim()) : c.title,
      messages: [...c.messages, userMsg, { role: 'assistant', content: '' }],
    }))
    setInput('')
    setLoading(true)
    setStreamingId(cid)

    const prev = convos.find(c => c.id === cid)?.messages ?? []
    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...prev, userMsg], context: ctx }),
      })

      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(errJson.error ?? 'Request failed')
      }

      setStreaming(true)
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setConvos(p => p.map(c => {
          if (c.id !== cid) return c
          const msgs = [...c.messages]
          msgs[msgs.length - 1] = { role: 'assistant', content: accumulated }
          return { ...c, messages: msgs }
        }))
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
      }

      const rTokens = estimateTokens(accumulated)
      setConvos(p => p.map(c => {
        if (c.id !== cid) return c
        const msgs = [...c.messages]
        msgs[msgs.length - 1] = { role: 'assistant', content: accumulated, tokens: rTokens }
        return { ...c, messages: msgs, totalTokens: (c.totalTokens ?? 0) + (userMsg.tokens ?? 0) + rTokens }
      }))
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Connection failed. Please try again.'
      setConvos(p => p.map(c => {
        if (c.id !== cid) return c
        const msgs = [...c.messages]
        msgs[msgs.length - 1] = { role: 'assistant', content: `Connection failed — ${errMsg}` }
        return { ...c, messages: msgs }
      }))
    } finally {
      setLoading(false)
      setStreaming(false)
      setStreamingId(null)
    }
  }, [loading, activeId, convos, ctx])

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const cat = CATEGORIES[activeCat]

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', background: C.bg, overflow: 'hidden' }}>

      {/* ── Left sidebar ─────────────────────────────────── */}
      <div style={{ width: 268, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: C.panel, flexShrink: 0, overflowY: 'auto' }}>

        {/* Branding */}
        <div style={{ padding: '16px 16px 14px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(135deg, rgba(160,0,200,0.05) 0%, rgba(160,0,200,0.02) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: C.purpleGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
              <Bot size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>AI Business Advisor</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.emerald }} />
                <span style={{ fontSize: 10.5, color: C.emerald, fontWeight: 600 }}>Vya Pulse AI</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            Your strategic brain for real estate sales — scripts, pipeline, market intel.
          </p>
        </div>

        {/* Live pipeline */}
        <LivePanel ctx={ctx} onLeadClick={injectLead} onDealClick={injectDeal} ctxLoading={ctxLoading} onRefresh={loadCtx} />

        {/* Chat history */}
        <div style={{ flex: 1, padding: '10px 10px 6px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 8px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Conversations</p>
          </div>
          {convos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <MessageSquare size={18} color={C.border} style={{ margin: '0 auto 6px', display: 'block' }} />
              <p style={{ fontSize: 11.5, color: C.label, margin: 0 }}>No chats yet</p>
            </div>
          ) : convos.map(c => (
            <div key={c.id} onClick={() => setActiveId(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, cursor: 'pointer', marginBottom: 2, background: c.id === activeId ? C.blueDim : 'transparent', border: `1px solid ${c.id === activeId ? C.blueBorder : 'transparent'}` }}>
              <MessageSquare size={12} color={c.id === activeId ? C.blue : C.label} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: c.id === activeId ? C.blue : C.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: c.id === activeId ? 600 : 400 }}>{c.title}</span>
              <button onClick={e => delConvo(c.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.label, padding: 2, opacity: 0.6, flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = C.red)} onMouseLeave={e => (e.currentTarget.style.color = C.label)}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>

        {/* New chat */}
        <div style={{ padding: '10px 12px 14px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={newConvo} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 0', borderRadius: 10, background: C.purpleGrad, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 10px rgba(160,0,200,0.3)' }}>
            <Plus size={14} /> New Chat
          </button>
        </div>
      </div>

      {/* ── Main chat area ────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.bg }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: C.purpleGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{active?.title ?? 'AI Business Advisor'}</div>
              {ctx && <div style={{ fontSize: 11, color: C.muted }}>{ctx.hotLeadsCount} hot leads · {ctx.pipelineValue} pipeline</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {totalTokens > 0 && <TokenBadge tokens={totalTokens} />}
            {ctx && <span style={{ fontSize: 11, color: C.emerald, background: C.emeraldDim, border: `1px solid #A7F3D0`, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>● Live data</span>}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}>

          {/* Empty state */}
          {(!active || active.messages.length === 0) && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, maxWidth: 680, margin: '0 auto', width: '100%', padding: '20px 0' }}>
              {/* Hero */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: C.purpleGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(37,99,235,0.2)' }}>
                  <Bot size={28} color="#fff" />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 8px' }}>What do you need today?</h2>
                <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.6 }}>
                  I know your pipeline, your leads by name, and the Indian market.<br />
                  Ask anything — I'll give you scripts, strategy, and specific next steps.
                </p>
              </div>

              {/* Category tabs */}
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {CATEGORIES.map((c, i) => {
                    const Icon = c.icon
                    const sel  = activeCat === i
                    return (
                      <button key={i} onClick={() => setActiveCat(i)} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                        borderRadius: 20, border: `1.5px solid ${sel ? c.color : C.border}`,
                        background: sel ? c.colorDim : C.panel,
                        color: sel ? c.color : C.muted, fontSize: 12.5, fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}>
                        <Icon size={13} />
                        {c.label}
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {cat.prompts.map((p, i) => (
                    <button key={i} onClick={() => send(p)} style={{
                      padding: '14px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', lineHeight: 1.5,
                      background: C.panel, border: `1.5px solid ${C.border}`,
                      color: C.text, fontSize: 13, transition: 'all 0.12s',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.background = cat.colorDim; e.currentTarget.style.boxShadow = `0 4px 14px ${cat.color}18` }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.panel; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}>
                      <span>{p}</span>
                      <ArrowRight size={14} color={C.label} style={{ flexShrink: 0, marginTop: 2 }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Click lead hint */}
              {ctx && ctx.hotLeads.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: C.blueDim, border: `1px solid ${C.blueBorder}`, borderRadius: 12 }}>
                  <Star size={13} color={C.blue} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: C.blue, margin: 0 }}>
                    <strong>Tip:</strong> Click any lead or deal in the left panel to instantly ask about them.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Message thread */}
          {active?.messages.map((msg, i) => {
            const isUser      = msg.role === 'user'
            const isStreaming  = !isUser && streaming && streamingId === activeId && i === (active.messages.length - 1)
            const isThinking   = !isUser && msg.content === '' && loading

            return (
              <div key={i} style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start', maxWidth: 860, width: '100%', alignSelf: isUser ? 'flex-end' : 'flex-start', animation: 'fadeUp 0.2s ease-out' }}>

                {/* AI avatar only */}
                {!isUser && (
                  <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.purpleGrad, boxShadow: '0 2px 8px rgba(160,0,200,0.25)', marginTop: 2 }}>
                    <Bot size={14} color="#fff" />
                  </div>
                )}

                {/* Message content */}
                {isUser ? (
                  <div style={{
                    maxWidth: '72%', background: 'linear-gradient(135deg, #4c00b0, #8a00c2)',
                    borderRadius: '18px 4px 18px 18px', padding: '11px 17px',
                    boxShadow: '0 2px 8px rgba(30,27,75,0.2)',
                  }}>
                    <p style={{ margin: 0, fontSize: 13.5, color: '#fff', lineHeight: 1.6 }}>{msg.content}</p>
                  </div>
                ) : (
                  <div style={{
                    flex: 1, background: C.panel,
                    borderLeft: `3px solid ${C.violet}`,
                    borderRadius: '0 14px 14px 14px',
                    padding: '14px 18px',
                    boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                  }}>
                    {isThinking
                      ? <ThinkingDots />
                      : <MsgContent content={msg.content} showCursor={isStreaming} />
                    }
                    {msg.tokens && msg.tokens > 0 && !isStreaming && (
                      <div style={{ marginTop: 8, paddingTop: 7, borderTop: `1px solid ${C.borderDim}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Coins size={10} color={C.label} />
                        <span style={{ fontSize: 10, color: C.label }}>~{msg.tokens} tokens · ₹{(estimateCostUSD(msg.tokens) * 84).toFixed(3)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: '12px 24px 16px', background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: '#FAFAFF', border: `1.5px solid ${C.violetBorder}`, borderRadius: 18, padding: '10px 10px 10px 16px', maxWidth: 820, margin: '0 auto', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onFocusCapture={e => { e.currentTarget.style.borderColor = C.violet; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(160,0,200,0.1)` }}
            onBlurCapture={e  => { e.currentTarget.style.borderColor = C.violetBorder; e.currentTarget.style.boxShadow = 'none' }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              placeholder={ctx?.hotLeads[0] ? `Ask about ${ctx.hotLeads[0].name}, write a script, get market intel…` : 'Ask anything about your pipeline, clients, or market…'}
              rows={1} disabled={loading}
              style={{ flex: 1, background: 'transparent', border: 'none', color: C.text, fontSize: 13.5, resize: 'none', outline: 'none', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', lineHeight: 1.6, maxHeight: 120, overflow: 'auto' }} />
            <button onClick={() => send(input)} disabled={!input.trim() || loading}
              style={{ width: 38, height: 38, borderRadius: 12, border: 'none', flexShrink: 0, background: input.trim() && !loading ? C.purpleGrad : C.borderDim, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.15s', boxShadow: input.trim() && !loading ? '0 2px 10px rgba(160,0,200,0.35)' : 'none' }}>
              {loading ? <Loader2 size={15} color={C.muted} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} color={input.trim() ? '#fff' : C.label} />}
            </button>
          </div>
          <p style={{ fontSize: 11, color: C.label, textAlign: 'center', margin: '8px 0 0' }}>
            Vya Pulse AI · Live pipeline context · ↵ to send, ⇧↵ for newline
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bounce  { 0%,100%{transform:translateY(0);opacity:.5} 50%{transform:translateY(-4px);opacity:1} }
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
