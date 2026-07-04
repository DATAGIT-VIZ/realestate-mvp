'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Bot, Send, Plus, Trash2, MessageSquare, User, Loader2,
  Sparkles, ChevronLeft, Copy, CheckCheck, Zap,
  Phone, MessageCircle, TrendingUp, Target, Building2,
  Users, RefreshCw,
} from 'lucide-react'
import type { AdvisorContext, LiveLead, LiveDeal } from '@/app/api/ai-assistant/route'
import type { CRMLead } from '@/lib/twenty'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       '#080D18',
  panel:    '#0E1623',
  panelAlt: '#111C2D',
  border:   'rgba(255,255,255,0.07)',
  amber:    '#F59E0B',
  amberDim: 'rgba(245,158,11,0.10)',
  blue:     '#3B82F6',
  emerald:  '#10B981',
  muted:    'rgba(255,255,255,0.35)',
  label:    'rgba(255,255,255,0.20)',
  text:     '#F1F5F9',
}

// ─── Types ──────────────────────────────────────────────────────────────────────
interface ChatMessage { role: 'user' | 'assistant'; content: string }
interface Conversation { id: string; title: string; messages: ChatMessage[]; createdAt: number }

const STORAGE_KEY = 'ai_advisor_v2_conversations'
const MAX_CONVOS  = 20

function genId()   { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function shortTitle(s: string) { return s.length > 42 ? s.slice(0, 42) + '…' : s }
function fmt(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

// ─── Quick Prompt categories ───────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { cat: 'Scripts',     icon: MessageCircle, color: '#10B981', prompts: [
    'Write a WhatsApp follow-up message for my top-scoring lead',
    'Give me an opening call script for a new inbound lead',
    'Draft a site visit confirmation message I can send right now',
    'Write a "just checking in" WhatsApp nudge for a lead who went silent',
  ]},
  { cat: 'Objections',  icon: Zap,           color: '#F59E0B', prompts: [
    'How do I respond when a buyer says "price is too high"?',
    'What do I say when a client says "I\'ll think about it and call you"?',
    'My client wants a 10% discount — what should I counter with?',
    'Buyer\'s loan got rejected — how do I keep the deal alive?',
  ]},
  { cat: 'Pipeline',    icon: TrendingUp,    color: '#3B82F6', prompts: [
    'Which lead should I call first today and why?',
    'Which deal in my pipeline is closest to closing? What\'s the next step?',
    'How do I move a lead from site visit to negotiation faster?',
    'I have 5 leads in negotiation — how do I prioritise them?',
  ]},
  { cat: 'Market',      icon: Building2,     color: '#A78BFA', prompts: [
    'What\'s the current buyer sentiment for my top cities?',
    'Which property type should I focus on for maximum commission this quarter?',
    'Give me 3 talking points about why now is a good time to buy',
    'What\'s happening with the luxury segment (₹2–5Cr) right now?',
  ]},
]

// ─── Markdown renderer ─────────────────────────────────────────────────────────
function MsgContent({ content }: { content: string }) {
  const [copied, setCopied] = useState<number | null>(null)

  const copyBlock = (code: string, i: number) => {
    navigator.clipboard.writeText(code)
    setCopied(i)
    setTimeout(() => setCopied(null), 2000)
  }

  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g)
  let codeIdx = 0

  return (
    <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.75, wordBreak: 'break-word' }}>
      {parts.map((part, pi) => {
        if (part.startsWith('```')) {
          const ci = codeIdx++
          const code = part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim()
          return (
            <div key={pi} style={{ position: 'relative', margin: '10px 0' }}>
              <div style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 10, padding: '14px 16px', fontFamily: 'monospace',
                fontSize: 13, color: '#E2E8F0', lineHeight: 1.7, whiteSpace: 'pre-wrap',
              }}>{code}</div>
              <button onClick={() => copyBlock(code, ci)} style={{
                position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(245,158,11,0.3)',
                background: 'rgba(245,158,11,0.1)', color: C.amber, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                {copied === ci ? <><CheckCheck size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
          )
        }
        // Render markdown-lite
        const lines = part.split('\n')
        return (
          <div key={pi}>
            {lines.map((line, li) => {
              if (line.startsWith('### ')) return <p key={li} style={{ fontWeight: 700, color: C.amber, margin: '10px 0 4px', fontSize: 13 }}>{line.slice(4)}</p>
              if (line.startsWith('## '))  return <p key={li} style={{ fontWeight: 700, color: C.amber, margin: '12px 0 5px', fontSize: 14 }}>{line.slice(3)}</p>
              if (line.startsWith('# '))   return <p key={li} style={{ fontWeight: 800, color: C.text,  margin: '14px 0 6px', fontSize: 15 }}>{line.slice(2)}</p>
              if (line.startsWith('- ') || line.startsWith('• '))
                return <div key={li} style={{ display: 'flex', gap: 8, margin: '3px 0', alignItems: 'flex-start' }}><span style={{ color: C.amber, flexShrink: 0, marginTop: 4, fontSize: 9 }}>●</span><span>{renderInline(line.slice(2))}</span></div>
              if (/^\d+\.\s/.test(line))
                return <div key={li} style={{ display: 'flex', gap: 8, margin: '3px 0' }}><span style={{ color: C.amber, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{line.match(/^\d+/)![0]}.</span><span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span></div>
              if (line.trim() === '') return <div key={li} style={{ height: 5 }} />
              return <p key={li} style={{ margin: '2px 0' }}>{renderInline(line)}</p>
            })}
          </div>
        )
      })}
    </div>
  )
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} style={{ color: '#fff', fontWeight: 600 }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  )
}

function Dots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: C.amber, animation: `pulse 1.3s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
    </div>
  )
}

// ─── Context Panel ─────────────────────────────────────────────────────────────
function ContextPanel({ ctx, loading }: { ctx: AdvisorContext | null; loading: boolean }) {
  if (loading) return (
    <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 12 }}>
      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading your data…
    </div>
  )
  if (!ctx) return null

  const stats = [
    { label: 'Hot leads',   value: String(ctx.hotLeadsCount), color: C.amber   },
    { label: 'Pipeline',    value: ctx.pipelineValue,         color: C.emerald },
    { label: 'Win rate',    value: `${ctx.winRate}%`,         color: C.blue    },
    { label: 'Avg score',   value: `${ctx.avgScore}/100`,     color: '#A78BFA' },
  ]

  return (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Live Context</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '7px 10px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: C.label, marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {ctx.hotLeads.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: C.label, margin: '0 0 6px', fontWeight: 600 }}>TOP LEADS</p>
          {ctx.hotLeads.slice(0, 4).map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 11.5, color: C.text, fontWeight: 500 }}>{l.name}</span>
              <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.15)', color: C.amber, borderRadius: 6, padding: '1px 7px', fontWeight: 700 }}>{l.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AdvisorPage() {
  const [convos,     setConvos]     = useState<Conversation[]>([])
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [sidebar,    setSidebar]    = useState(true)
  const [ctx,        setCtx]        = useState<AdvisorContext | null>(null)
  const [ctxLoading, setCtxLoading] = useState(true)
  const [activeTab,  setActiveTab]  = useState(0)
  const endRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load convos
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s) {
        const p: Conversation[] = JSON.parse(s)
        setConvos(p)
        if (p.length) setActiveId(p[0].id)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (convos.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, MAX_CONVOS)))
  }, [convos])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [convos, loading])

  // Fetch live context
  const loadContext = useCallback(async () => {
    setCtxLoading(true)
    try {
      type DealRow = { stage: string; deal_value: number; lead_name: string; city: string; assigned_to: string; expected_close?: string; source_portal?: string }

      const [leadsRes, dealsRes] = await Promise.all([
        fetch('/api/crm/leads?limit=50').then(r => r.json()),
        fetch('/api/deals').then(r => r.json()),
      ])

      const leads: CRMLead[] = leadsRes.data?.leads ?? leadsRes.data ?? []
      const deals: DealRow[] = dealsRes.data ?? []

      // Hot leads — use intentScore (the Twenty.com field)
      const hot = leads
        .filter(l => (l.intentScore ?? 0) >= 50)
        .sort((a, b) => (b.intentScore ?? 0) - (a.intentScore ?? 0))

      const hotLeads: LiveLead[] = hot.map(l => ({
        name:         `${l.name?.firstName ?? ''} ${l.name?.lastName ?? ''}`.trim() || 'Unknown',
        phone:        l.phones?.primaryPhoneNumber ?? '',
        city:         l.city ?? '',
        propertyType: l.propertyType?.[0] ?? '',
        score:        l.intentScore ?? 0,
        stage:        l.status ?? '',
        source:       l.sourcePortal ?? '',
      }))

      // Active deals
      const active = deals.filter(d => !['won', 'lost'].includes(d.stage))
      const activeDeals: LiveDeal[] = active.map(d => ({
        leadName:      d.lead_name,
        value:         fmt(d.deal_value),
        rawValue:      d.deal_value,
        stage:         d.stage,
        city:          d.city,
        agent:         d.assigned_to,
        expectedClose: d.expected_close,
        sourcePortal:  d.source_portal,
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

      const won     = deals.filter(d => d.stage === 'won').length
      const total   = deals.filter(d => ['won', 'lost'].includes(d.stage)).length
      const winRate = total ? Math.round((won / total) * 100) : 0

      const pipelineVal = active.reduce((s, d) => s + d.deal_value, 0)

      const scores   = leads.filter(l => l.intentScore).map(l => l.intentScore ?? 0)
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

      // Portal counts from lead sources
      const portalCounts: Record<string, number> = {}
      for (const l of leads) {
        const src = l.sourcePortal
        if (src) portalCounts[src] = (portalCounts[src] ?? 0) + 1
      }
      const topSource = Object.entries(portalCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'Unknown'

      setCtx({
        totalLeads:         leads.length,
        hotLeadsCount:      hot.length,
        avgScore,
        responseRate:       72,
        topSource,
        hotLeads,
        activeDeals,
        pipelineValue:      fmt(pipelineVal),
        winRate,
        dealsNearClose:     nearClose,
        recentPortalCounts: portalCounts,
      })
    } catch { /* ignore, context is best-effort */ } finally {
      setCtxLoading(false)
    }
  }, [])

  useEffect(() => { loadContext() }, [loadContext])

  const active = convos.find(c => c.id === activeId) ?? null

  const newConvo = useCallback(() => {
    const c: Conversation = { id: genId(), title: 'New conversation', messages: [], createdAt: Date.now() }
    setConvos(p => [c, ...p])
    setActiveId(c.id)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const delConvo = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConvos(p => {
      const next = p.filter(c => c.id !== id)
      if (activeId === id) setActiveId(next[0]?.id ?? null)
      return next
    })
  }, [activeId])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: text.trim() }

    let cid = activeId
    if (!cid) {
      const c: Conversation = { id: genId(), title: shortTitle(text.trim()), messages: [], createdAt: Date.now() }
      setConvos(p => [c, ...p])
      setActiveId(c.id)
      cid = c.id
    }

    setConvos(p => p.map(c => c.id !== cid ? c : {
      ...c,
      title:    c.messages.length === 0 ? shortTitle(text.trim()) : c.title,
      messages: [...c.messages, userMsg, { role: 'assistant', content: '' }],
    }))
    setInput('')
    setLoading(true)

    const prev = (convos.find(c => c.id === cid)?.messages ?? [])
    try {
      const res  = await fetch('/api/ai-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...prev, userMsg], context: ctx }),
      })
      const data = await res.json()
      const reply = data.content || data.error || 'No response.'
      setConvos(p => p.map(c => {
        if (c.id !== cid) return c
        const msgs = [...c.messages]
        msgs[msgs.length - 1] = { role: 'assistant', content: reply }
        return { ...c, messages: msgs }
      }))
    } catch {
      setConvos(p => p.map(c => {
        if (c.id !== cid) return c
        const msgs = [...c.messages]
        msgs[msgs.length - 1] = { role: 'assistant', content: '⚠️ Connection failed. Please try again.' }
        return { ...c, messages: msgs }
      }))
    } finally { setLoading(false) }
  }, [loading, activeId, convos, ctx])

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const tabStyle = (a: boolean): React.CSSProperties => ({
    flex: 1, padding: '7px 4px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
    background: a ? 'rgba(245,158,11,0.15)' : 'transparent',
    color: a ? C.amber : C.muted, borderRadius: 8, transition: 'all 0.12s',
  })

  const tab = QUICK_PROMPTS[activeTab]

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', background: C.bg, overflow: 'hidden' }}>

      {/* ── Left sidebar ─────────────────────────────────────────────── */}
      {sidebar && (
        <div style={{ width: 260, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: 'rgba(8,13,24,0.8)' }}>

          {/* Branding */}
          <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(245,158,11,0.08))', border: '1px solid rgba(245,158,11,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={17} color={C.amber} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>AI Business Advisor</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Powered by Claude</div>
            </div>
          </div>

          {/* Live context */}
          <ContextPanel ctx={ctx} loading={ctxLoading} />

          {/* Conversations */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px 8px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Chats</p>
              <button onClick={loadContext} title="Refresh data" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.label, padding: 2 }}>
                <RefreshCw size={11} />
              </button>
            </div>
            {convos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                <MessageSquare size={20} color="rgba(255,255,255,0.1)" style={{ margin: '0 auto 6px' }} />
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.18)', margin: 0 }}>No chats yet</p>
              </div>
            ) : convos.map(c => (
              <div key={c.id} onClick={() => setActiveId(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, cursor: 'pointer', marginBottom: 2, background: c.id === activeId ? 'rgba(245,158,11,0.1)' : 'transparent', border: `1px solid ${c.id === activeId ? 'rgba(245,158,11,0.2)' : 'transparent'}` }}>
                <MessageSquare size={12} color={c.id === activeId ? C.amber : C.muted} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: c.id === activeId ? C.text : C.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                <button onClick={e => delConvo(c.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', opacity: 0.5, padding: 2, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          {/* New chat */}
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}` }}>
            <button onClick={newConvo} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 0', borderRadius: 10, background: C.amberDim, border: `1px solid rgba(245,158,11,0.25)`, color: C.amber, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={14} /> New Chat
            </button>
          </div>
        </div>
      )}

      {/* ── Main chat ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setSidebar(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}>
              <ChevronLeft size={16} style={{ transform: sidebar ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
            </button>
            <Sparkles size={14} color={C.amber} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
              {active ? active.title : 'AI Business Advisor'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {ctx && <span style={{ fontSize: 11, color: C.emerald, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>● Live data connected</span>}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>

          {/* Empty state */}
          {(!active || active.messages.length === 0) && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center', padding: '20px 0', maxWidth: 640, margin: '0 auto', width: '100%' }}>
              <div>
                <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.06))', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Sparkles size={26} color={C.amber} />
                </div>
                <p style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 8px' }}>Your AI Real Estate Advisor</p>
                <p style={{ fontSize: 13.5, color: C.muted, margin: 0, lineHeight: 1.6 }}>
                  I know your live pipeline, your top leads by name, and the Indian market.<br />
                  Ask me anything — scripts, objections, strategy, market intel.
                </p>
              </div>

              {/* Tab bar */}
              <div style={{ width: '100%', maxWidth: 560 }}>
                <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, marginBottom: 12 }}>
                  {QUICK_PROMPTS.map((cat, i) => {
                    const Icon = cat.icon
                    return (
                      <button key={i} style={tabStyle(activeTab === i)} onClick={() => setActiveTab(i)}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <Icon size={13} style={{ color: activeTab === i ? cat.color : 'inherit' }} />
                          {cat.cat}
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {tab.prompts.map((p, i) => (
                    <button key={i} onClick={() => send(p)} style={{
                      padding: '11px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', lineHeight: 1.45,
                      background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
                      color: C.text, fontSize: 12.5, transition: 'all 0.12s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${tab.color}12`; e.currentTarget.style.borderColor = `${tab.color}40` }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = C.border }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Thread */}
          {active?.messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 12, alignItems: 'flex-start', maxWidth: 820, width: '100%', ...(msg.role === 'user' ? { alignSelf: 'flex-end' } : {}) }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: msg.role === 'user' ? 'rgba(59,130,246,0.15)' : 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.08))', border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.25)' : 'rgba(245,158,11,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {msg.role === 'user' ? <User size={14} color="#60A5FA" /> : <Bot size={14} color={C.amber} />}
              </div>
              <div style={{ maxWidth: '80%', background: msg.role === 'user' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.035)', border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px', padding: '12px 16px' }}>
                {msg.content === '' && msg.role === 'assistant' ? <Dots /> : <MsgContent content={msg.content} />}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 20px 18px', borderTop: `1px solid ${C.border}`, background: 'rgba(8,13,24,0.5)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: '10px 14px', maxWidth: 820, margin: '0 auto' }}
            onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)')}
            onBlurCapture={e  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              placeholder={ctx ? `Ask about ${ctx.hotLeads[0]?.name ?? 'your leads'}, pipeline strategy, scripts…` : 'Ask anything about your business…'}
              rows={1} disabled={loading}
              style={{ flex: 1, background: 'transparent', border: 'none', color: C.text, fontSize: 13.5, resize: 'none', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.55, maxHeight: 140, overflow: 'auto' }} />
            <button onClick={() => send(input)} disabled={!input.trim() || loading}
              style={{ width: 38, height: 38, borderRadius: 11, border: 'none', flexShrink: 0, background: input.trim() && !loading ? C.amber : 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
              {loading ? <Loader2 size={15} color={C.muted} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} color={input.trim() ? '#000' : C.muted} />}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', textAlign: 'center', margin: '7px 0 0' }}>
            AI Advisor · Powered by Claude · Grounded in your live pipeline data · ↵ to send
          </p>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:.4;transform:scale(.85)}50%{opacity:1;transform:scale(1)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
