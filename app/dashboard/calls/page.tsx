'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PhoneCall, PhoneOff, PhoneMissed, SkipForward,
  CheckCircle, MapPin, Home, Loader2, RotateCcw,
  MessageCircle, Star, ChevronRight, Trophy, Copy, Check,
  Flame, Thermometer, Snowflake, Clock, Phone, List,
  Building2, Globe, ClipboardList, ChevronDown,
} from 'lucide-react'

type CallMode = 'corporate' | 'internet' | 'manual'

const CALL_MODES: { id: CallMode; label: string; sub: string; icon: React.ElementType; color: string }[] = [
  { id: 'corporate', label: 'Corporate Number', sub: 'Dial from your work SIM / company phone', icon: Building2, color: '#2563EB' },
  { id: 'internet',  label: 'Internet Calling',  sub: 'Browser call via Exotel / Twilio',        icon: Globe,      color: '#7C3AED' },
  { id: 'manual',    label: 'Manual Log',        sub: 'Already called? Just log the outcome',   icon: ClipboardList, color: '#059669' },
]

function formatIndianPhone(raw: string) {
  const d = raw.replace(/\D/g, '')
  const n = d.startsWith('91') && d.length === 12 ? d.slice(2) : d
  if (n.length === 10) return `+91 ${n.slice(0,5)} ${n.slice(5)}`
  return raw
}

const C = {
  bg:         '#F8FAFC',
  panel:      '#FFFFFF',
  border:     '#E2E8F0',
  borderDim:  '#F1F5F9',
  text:       '#0F172A',
  muted:      '#64748B',
  label:      '#94A3B8',
  blue:       '#2563EB',
  blueDim:    '#EFF6FF',
  emerald:    '#059669',
  emeraldDim: '#ECFDF5',
  amber:      '#D97706',
  amberDim:   '#FFFBEB',
  red:        '#EF4444',
  redDim:     '#FFF1F2',
  violet:     '#7C3AED',
}

const OUTCOMES = [
  { id: 'connected',      label: 'Connected',     icon: CheckCircle,  color: C.emerald, dim: C.emeraldDim, emoji: '✅' },
  { id: 'no_answer',      label: 'No Answer',     icon: PhoneMissed,  color: C.amber,   dim: C.amberDim,   emoji: '📵' },
  { id: 'callback',       label: 'Call Back',     icon: Clock,        color: C.blue,    dim: C.blueDim,    emoji: '🔁' },
  { id: 'not_interested', label: 'Not Interested',icon: PhoneOff,     color: C.red,     dim: C.redDim,     emoji: '❌' },
]

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
  leadPortalId?: string | null
}

function getCsId(l: Lead): string {
  if (l.leadPortalId?.startsWith('CS')) return l.leadPortalId
  const hex = l.id.replace(/-/g, '')
  let n = 0
  for (const c of hex) n = (n * 31 + parseInt(c, 16)) % 100000
  return `CS${String(n).padStart(5, '0')}`
}

interface CallLog {
  leadName: string
  phone: string
  outcome: string
  note: string
  duration: number
}

function fname(l: Lead) { return `${l.name.firstName} ${l.name.lastName ?? ''}`.trim() }
function fmtTime(s: number) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` }
function fmtBudget(min?: number|null, max?: number|null) {
  const f = (n: number) => n >= 10_000_000 ? `₹${(n/10_000_000).toFixed(1)}Cr` : `₹${(n/100_000).toFixed(0)}L`
  if (min && max) return `${f(min)}–${f(max)}`
  if (max) return `Up to ${f(max)}`
  if (min) return `From ${f(min)}`
  return null
}
function waLink(phone: string) {
  const c = phone.replace(/\D/g,'')
  const n = c.startsWith('91') ? c : `91${c.replace(/^0/,'')}`
  return `https://wa.me/${n}`
}

function ScorePill({ score }: { score?: number|null }) {
  if (!score) return null
  const hot  = score >= 75
  const warm = score >= 50
  const Icon = hot ? Flame : warm ? Thermometer : Snowflake
  const color = hot ? C.red : warm ? C.amber : C.blue
  const dim   = hot ? C.redDim : warm ? C.amberDim : C.blueDim
  const label = hot ? 'Hot' : warm ? 'Warm' : 'New'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:800, background:dim, color, borderRadius:20, padding:'3px 10px', border:`1px solid ${color}30` }}>
      <Icon size={11}/> {label} {score}
    </span>
  )
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return mobile
}

export default function PowerDialerPage() {
  const isMobile = useIsMobile()
  const [leads,     setLeads]     = useState<Lead[]>([])
  const [loading,   setLoading]   = useState(true)
  const [queueIdx,  setQueueIdx]  = useState(0)
  const [step,      setStep]      = useState<1|2|3>(1)
  const [elapsed,   setElapsed]   = useState(0)
  const [outcome,   setOutcome]   = useState('')
  const [note,      setNote]      = useState('')
  const [log,       setLog]       = useState<CallLog[]>([])
  const [stats,     setStats]     = useState({ total:0, connected:0, skipped:0 })
  const [copied,    setCopied]    = useState(false)
  const [csidCopied, setCsidCopied] = useState(false)
  const [sessionOn, setSessionOn] = useState(false)
  const [showLog,   setShowLog]   = useState(false)
  const [callMode,  setCallMode]  = useState<CallMode>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('dialer-mode') as CallMode) ?? 'corporate'
    return 'corporate'
  })
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/crm/leads?limit=50')
      const j = await r.json()
      const arr: Lead[] = j.data?.leads ?? j.data ?? j.leads ?? []
      setLeads(arr.sort((a,b) => (b.intentScore??0)-(a.intentScore??0)))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadLeads() }, [loadLeads])

  useEffect(() => {
    if (step === 2) {
      timerRef.current = setInterval(() => setElapsed(e => e+1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [step])

  const current  = leads[queueIdx]
  const phone    = current?.phones?.primaryPhoneNumber ?? ''
  const name     = current ? fname(current) : ''
  const budget   = current ? fmtBudget(current.budgetMin, current.budgetMax) : null
  const outMeta  = OUTCOMES.find(o => o.id === outcome)
  const csId     = current ? getCsId(current) : ''

  const copyCsId = () => {
    if (!csId) return
    navigator.clipboard.writeText(csId)
    setCsidCopied(true)
    setTimeout(() => setCsidCopied(false), 2000)
  }

  const changeMode = (m: CallMode) => {
    setCallMode(m)
    localStorage.setItem('dialer-mode', m)
  }

  const startCall = () => {
    if (callMode === 'manual' || callMode === 'internet') {
      setStep(3); return
    }
    setStep(2); setElapsed(0)
    if (phone) { const a = document.createElement('a'); a.href = `tel:${phone}`; a.click() }
  }

  const logAndNext = () => {
    if (!outcome) return
    setLog(prev => [{ leadName:name, phone, outcome, note, duration:elapsed }, ...prev])
    setStats(s => ({ ...s, total:s.total+1, connected:s.connected+(outcome==='connected'?1:0) }))
    setOutcome(''); setNote(''); setElapsed(0); setStep(1)
    setQueueIdx(i => i+1)
  }

  const skip = () => {
    setStats(s => ({ ...s, total:s.total+1, skipped:s.skipped+1 }))
    setOutcome(''); setNote(''); setElapsed(0); setStep(1)
    setQueueIdx(i => i+1)
  }

  const copyPhone = () => {
    navigator.clipboard.writeText(phone)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const restart = () => { setQueueIdx(0); setStats({total:0,connected:0,skipped:0}); setStep(1); setSessionOn(false) }
  const connectRate = stats.total ? Math.round(stats.connected/stats.total*100) : 0

  // ── Welcome ────────────────────────────────────────────────────────────
  if (!sessionOn) {
    return (
      <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column' }}>
        <div style={{ flex:1, padding: isMobile ? '32px 20px 20px' : '40px 28px', maxWidth: isMobile ? '100%' : 600, margin:'0 auto', width:'100%' }}>
          <div style={{ textAlign:'center', marginBottom: isMobile ? 28 : 36 }}>
            <div style={{ width:isMobile?64:72, height:isMobile?64:72, borderRadius:20, background:'linear-gradient(135deg,#2563EB,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 8px 24px rgba(37,99,235,0.25)' }}>
              <Phone size={isMobile?26:30} color="#fff"/>
            </div>
            <h1 style={{ fontSize:isMobile?22:26, fontWeight:800, color:C.text, margin:'0 0 8px' }}>Power Dialer</h1>
            <p style={{ fontSize:14, color:C.muted, margin:0, lineHeight:1.6 }}>
              Your hottest leads, sorted by score.<br/>
              Tap to call · Log in 3 taps · Move to next.
            </p>
          </div>

          {/* Calling mode selector */}
          <div style={{ marginBottom:16 }}>
            <p style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 10px 2px' }}>Select calling mode</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {CALL_MODES.map(m => {
                const Icon = m.icon
                const sel  = callMode === m.id
                return (
                  <button key={m.id} onClick={() => changeMode(m.id)}
                    style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:14, border:`2px solid ${sel ? m.color : C.border}`, background: sel ? `${m.color}08` : C.panel, cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
                    <div style={{ width:38, height:38, borderRadius:11, background: sel ? `${m.color}18` : C.bg, border:`1px solid ${sel ? m.color+'40' : C.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon size={17} color={sel ? m.color : C.muted}/>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color: sel ? m.color : C.text }}>{m.label}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{m.sub}</div>
                    </div>
                    <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${sel ? m.color : C.border}`, background: sel ? m.color : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {sel && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }}/>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Internet calling info banner */}
          {callMode === 'internet' && (
            <div style={{ background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', gap:10, alignItems:'flex-start' }}>
              <Globe size={15} color="#7C3AED" style={{ flexShrink:0, marginTop:1 }}/>
              <p style={{ fontSize:12, color:C.muted, margin:0, lineHeight:1.6 }}>
                <strong style={{ color:'#7C3AED' }}>Exotel / Twilio not connected.</strong> Browser calling needs a telephony provider. Connect one in <strong style={{ color:C.text }}>Settings → Integrations</strong>. Until then, you can still log call outcomes manually.
              </p>
            </div>
          )}

          {!loading && leads.length > 0 && (
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:18, overflow:'hidden', marginBottom:20 }}>
              <div style={{ padding:'11px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{leads.length} leads in queue</span>
                <span style={{ fontSize:11, color:C.label }}>Hottest first ↓</span>
              </div>
              {leads.slice(0,3).map(l => (
                <div key={l.id} style={{ padding:'10px 16px', borderBottom:`1px solid ${C.borderDim}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:10, background:C.blueDim, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:C.blue }}>{l.name.firstName.charAt(0)}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{fname(l)}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <span style={{ fontSize:9, fontWeight:700, color:'#64748B', background:'#F1F5F9', border:'1px solid #E2E8F0', padding:'1px 5px', borderRadius:4, fontFamily:'monospace', letterSpacing:'0.04em' }}>{getCsId(l)}</span>
                        <span style={{ fontSize:11, color:C.muted }}>{l.city ?? '—'}{l.propertyType?.[0] ? ` · ${l.propertyType[0]}` : ''}</span>
                      </div>
                    </div>
                  </div>
                  <ScorePill score={l.intentScore}/>
                </div>
              ))}
              {leads.length > 3 && <div style={{ padding:'10px 16px', textAlign:'center', fontSize:12, color:C.label }}>+{leads.length-3} more</div>}
            </div>
          )}
        </div>

        <div style={{ padding: isMobile ? '16px 20px 32px' : '0 28px 32px', maxWidth:isMobile?'100%':600, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>
          {loading
            ? <div style={{ textAlign:'center', padding:20, color:C.muted }}><Loader2 size={20} style={{ animation:'spin 1s linear infinite', display:'block', margin:'0 auto 8px' }}/> Loading leads…</div>
            : <button onClick={() => setSessionOn(true)} style={{ width:'100%', padding: isMobile?'18px 0':'16px 0', background:'linear-gradient(135deg,#2563EB,#7C3AED)', border:'none', borderRadius:16, color:'#fff', fontSize:isMobile?17:16, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(37,99,235,0.3)', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                <PhoneCall size={isMobile?20:18}/> Start Dialing Session
              </button>
          }
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Queue done ─────────────────────────────────────────────────────────
  if (queueIdx >= leads.length) {
    return (
      <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ textAlign:'center', maxWidth:400, width:'100%' }}>
          <div style={{ width:80, height:80, borderRadius:24, background:C.emeraldDim, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
            <Trophy size={36} color={C.emerald}/>
          </div>
          <h2 style={{ fontSize:24, fontWeight:800, color:C.text, margin:'0 0 8px' }}>Session complete!</h2>
          <p style={{ fontSize:14, color:C.muted, margin:'0 0 28px' }}>You called through the entire queue.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:28 }}>
            {[
              { label:'Called',    value:stats.total,      color:C.blue    },
              { label:'Connected', value:stats.connected,  color:C.emerald },
              { label:'Rate',      value:`${connectRate}%`,color:C.violet  },
            ].map(s => (
              <div key={s.label} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:14, padding:'16px 10px' }}>
                <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <button onClick={restart} style={{ width:'100%', padding:'16px 0', background:C.blue, border:'none', borderRadius:14, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
            Start New Session
          </button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── MOBILE active session ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column' }}>

        {/* Sticky top bar */}
        <div style={{ background:C.panel, borderBottom:`1px solid ${C.border}`, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:10 }}>
          <div>
            <span style={{ fontSize:13, fontWeight:700, color:C.text }}>Lead {queueIdx+1} / {leads.length}</span>
            <span style={{ fontSize:11, color:C.label, marginLeft:8 }}>{leads.length-queueIdx-1} left</span>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:700, background:C.emeraldDim, color:C.emerald, borderRadius:20, padding:'3px 10px' }}>{stats.connected} connected</span>
            <button onClick={() => setShowLog(v => !v)} style={{ padding:'6px 10px', border:`1px solid ${C.border}`, borderRadius:8, background:C.panel, color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11 }}>
              <List size={13}/> Log
            </button>
          </div>
        </div>

        {/* Call log drawer */}
        {showLog && (
          <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.4)' }} onClick={() => setShowLog(false)}>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, background:C.panel, borderRadius:'20px 20px 0 0', maxHeight:'70vh', overflow:'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, fontWeight:700, fontSize:14, color:C.text, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                Today&apos;s calls ({log.length})
                <button onClick={() => setShowLog(false)} style={{ border:'none', background:'none', fontSize:22, color:C.label, cursor:'pointer', lineHeight:1 }}>×</button>
              </div>
              {log.length === 0
                ? <div style={{ padding:24, textAlign:'center', fontSize:13, color:C.label }}>No calls yet</div>
                : log.map((c,i) => {
                    const o = OUTCOMES.find(x => x.id === c.outcome)
                    return (
                      <div key={i} style={{ padding:'12px 18px', borderBottom:`1px solid ${C.borderDim}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{c.leadName}</div>
                          <div style={{ fontSize:11, color:C.label }}>{fmtTime(c.duration)}</div>
                        </div>
                        {o && <span style={{ fontSize:11, fontWeight:800, background:o.dim, color:o.color, borderRadius:20, padding:'3px 10px' }}>{o.emoji} {o.label}</span>}
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 16px 120px' }}>

          {/* Lead card */}
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:22, overflow:'hidden', marginBottom:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ padding:'22px 20px 16px', background:'linear-gradient(135deg,#EFF6FF,#F5F3FF)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
                <div style={{ width:58, height:58, borderRadius:18, background:'linear-gradient(135deg,#2563EB,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:800, color:'#fff', flexShrink:0 }}>
                  {name.charAt(0)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:'0 0 5px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</h2>
                  <ScorePill score={current.intentScore}/>
                </div>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {current.city && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:C.muted, background:'rgba(255,255,255,0.8)', border:`1px solid ${C.border}`, borderRadius:20, padding:'3px 10px' }}><MapPin size={11}/>{current.city}</span>}
                {current.propertyType?.[0] && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:C.muted, background:'rgba(255,255,255,0.8)', border:`1px solid ${C.border}`, borderRadius:20, padding:'3px 10px' }}><Home size={11}/>{current.propertyType[0]}</span>}
                {budget && <span style={{ fontSize:12, fontWeight:600, color:C.emerald, background:C.emeraldDim, border:`1px solid #A7F3D0`, borderRadius:20, padding:'3px 10px' }}>{budget}</span>}
                {current.sourcePortal && <span style={{ fontSize:11, fontWeight:700, background:C.blueDim, color:C.blue, borderRadius:20, padding:'3px 10px' }}>{current.sourcePortal}</span>}
              </div>
            </div>
            {/* Phone number + CS ID */}
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}` }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: csId ? 8 : 0 }}>
                <span style={{ fontSize:20, fontWeight:800, color:C.text, letterSpacing:'0.02em' }}>{phone || '—'}</span>
                <button onClick={copyPhone} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', border:`1px solid ${C.border}`, borderRadius:9, background:copied ? C.emeraldDim : C.bg, color:copied ? C.emerald : C.muted, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {copied ? <><Check size={12}/>Copied!</> : <><Copy size={12}/>Copy</>}
                </button>
              </div>
              {csId && (
                <button onClick={copyCsId} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', border:`1px solid ${csidCopied ? '#A7F3D0' : C.border}`, borderRadius:7, background: csidCopied ? C.emeraldDim : '#F8FAFC', cursor:'pointer', transition:'all 0.15s' }}>
                  <span style={{ fontSize:12, fontWeight:700, color: csidCopied ? C.emerald : '#475569', fontFamily:'monospace', letterSpacing:'0.06em' }}>{csId}</span>
                  {csidCopied
                    ? <Check size={11} color={C.emerald} />
                    : <Copy size={11} color="#94A3B8" />}
                  <span style={{ fontSize:10, color: csidCopied ? C.emerald : '#94A3B8', fontWeight:500 }}>{csidCopied ? 'Copied!' : 'Copy ID'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Step 1 — call actions */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Mode pill */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:10 }}>
                <span style={{ fontSize:11, color:C.muted }}>Mode: <strong style={{ color:C.text }}>{CALL_MODES.find(m=>m.id===callMode)?.label}</strong></span>
                <button onClick={() => { setSessionOn(false); setStep(1) }} style={{ fontSize:11, color:C.blue, border:'none', background:'none', cursor:'pointer', fontWeight:600 }}>Change</button>
              </div>

              {callMode === 'corporate' && (
                <>
                  <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:14, padding:'14px 16px', textAlign:'center' }}>
                    <p style={{ fontSize:11, color:'#15803D', fontWeight:600, margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Dial this number from your work phone</p>
                    <p style={{ fontSize:24, fontWeight:800, color:C.text, margin:'0 0 8px', letterSpacing:'0.04em' }}>{formatIndianPhone(phone) || '—'}</p>
                    <button onClick={copyPhone} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 14px', border:`1px solid #86EFAC`, borderRadius:8, background:'#fff', color:'#15803D', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      {copied ? <><Check size={11}/>Copied!</> : <><Copy size={11}/>Copy number</>}
                    </button>
                  </div>
                  <button onClick={startCall} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'18px 0', background: phone ? 'linear-gradient(135deg,#059669,#047857)' : '#E2E8F0', borderRadius:16, color: phone ? '#fff' : C.label, fontSize:17, fontWeight:800, border:'none', cursor: phone ? 'pointer' : 'not-allowed', boxShadow: phone ? '0 6px 20px rgba(5,150,105,0.3)' : 'none' }}>
                    <PhoneCall size={20}/> I&apos;m calling now — start timer
                  </button>
                </>
              )}

              {callMode === 'internet' && (
                <div style={{ background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:14, padding:'20px', textAlign:'center' }}>
                  <Globe size={28} color="#7C3AED" style={{ marginBottom:8 }}/>
                  <p style={{ fontSize:13, fontWeight:700, color:'#7C3AED', margin:'0 0 4px' }}>Telephony provider not connected</p>
                  <p style={{ fontSize:12, color:C.muted, margin:'0 0 14px' }}>Connect Exotel or Twilio in Settings → Integrations to enable browser calling.</p>
                  <button onClick={startCall} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'10px 20px', background:'#7C3AED', border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    <ClipboardList size={14}/> Log manually instead
                  </button>
                </div>
              )}

              {callMode === 'manual' && (
                <button onClick={startCall} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'20px 0', background:'linear-gradient(135deg,#059669,#047857)', borderRadius:16, color:'#fff', fontSize:17, fontWeight:800, border:'none', cursor:'pointer', boxShadow:'0 6px 20px rgba(5,150,105,0.3)' }}>
                  <ClipboardList size={20}/> Log call outcome
                </button>
              )}

              {phone && callMode !== 'internet' && (
                <a href={waLink(phone)} target="_blank" rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'14px 0', background:'#DCFCE7', border:`1.5px solid #86EFAC`, borderRadius:14, color:'#15803D', fontSize:15, fontWeight:700, textDecoration:'none' }}>
                  <MessageCircle size={17}/> WhatsApp
                </a>
              )}
              <button onClick={skip} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'12px 0', background:'transparent', border:`1px solid ${C.border}`, borderRadius:14, color:C.label, fontSize:14, fontWeight:600, cursor:'pointer' }}>
                <SkipForward size={14}/> Skip this lead
              </button>
            </div>
          )}

          {/* Step 2 — in progress */}
          {step === 2 && (
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:20, padding:'32px 20px', textAlign:'center', boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.emerald, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Call in progress</div>
              <div style={{ fontSize:52, fontWeight:800, color:C.text, fontVariantNumeric:'tabular-nums' }}>{fmtTime(elapsed)}</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, margin:'10px 0 28px' }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:C.emerald, animation:'pulse 1.5s infinite' }}/>
                <span style={{ fontSize:13, color:C.muted }}>Calling {name.split(' ')[0]}…</span>
              </div>
              <button onClick={() => setStep(3)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'18px 0', background:C.red, border:'none', borderRadius:16, color:'#fff', fontSize:17, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 16px rgba(239,68,68,0.3)' }}>
                <PhoneOff size={20}/> Call Ended — Log It
              </button>
            </div>
          )}

          {/* Step 3 — log outcome */}
          {step === 3 && (
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:20, padding:'22px 18px', boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:'0 0 14px' }}>How did it go?</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                {OUTCOMES.map(o => {
                  const Icon = o.icon
                  const sel  = outcome === o.id
                  return (
                    <button key={o.id} onClick={() => setOutcome(o.id)}
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, padding:'18px 10px', borderRadius:16, border:`2px solid ${sel ? o.color : C.border}`, background: sel ? o.dim : C.bg, color: sel ? o.color : C.muted, fontSize:13, fontWeight:700, cursor:'pointer', minHeight:80 }}>
                      <Icon size={22}/>
                      {o.label}
                    </button>
                  )
                })}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Quick note (optional)…"
                style={{ width:'100%', padding:'12px 14px', border:`1px solid ${C.border}`, borderRadius:12, fontSize:14, color:C.text, resize:'none', minHeight:70, outline:'none', boxSizing:'border-box', marginBottom:14, background:C.bg }}/>
              <button onClick={logAndNext} disabled={!outcome}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'18px 0', background:!outcome ? C.borderDim : (outMeta?.color ?? C.blue), border:'none', borderRadius:16, color:!outcome ? C.label : '#fff', fontSize:17, fontWeight:800, cursor:!outcome ? 'not-allowed' : 'pointer', boxShadow: outcome ? `0 4px 16px ${outMeta?.color ?? C.blue}35` : 'none' }}>
                Log &amp; Next <ChevronRight size={18}/>
              </button>
              {elapsed > 0 && <p style={{ fontSize:11, color:C.label, textAlign:'center', margin:'10px 0 0' }}>Duration: {fmtTime(elapsed)}</p>}
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin  { to { transform: rotate(360deg) } }
          @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        `}</style>
      </div>
    )
  }

  // ── DESKTOP active session ─────────────────────────────────────────────
  return (
    <div className="px-4 py-5 pb-24 lg:px-7 min-h-screen" style={{ background:C.bg }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, color:C.text, margin:'0 0 2px' }}>Power Dialer</h1>
          <p style={{ fontSize:12, color:C.muted, margin:0 }}>Lead {queueIdx+1} of {leads.length} · {leads.length-queueIdx-1} remaining</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={loadLeads} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', border:`1px solid ${C.border}`, borderRadius:9, background:C.panel, color:C.muted, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <RotateCcw size={12}/> Refresh
          </button>
          <button onClick={restart} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', border:`1px solid ${C.border}`, borderRadius:9, background:C.panel, color:C.muted, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            End session
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[22px]">
        {[
          { label:'Remaining', value:leads.length-queueIdx, color:C.blue    },
          { label:'Dialed',    value:stats.total,           color:C.text    },
          { label:'Connected', value:stats.connected,       color:C.emerald },
          { label:'Rate',      value:`${connectRate}%`,     color:C.violet  },
        ].map(s => (
          <div key={s.label} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 16px' }}>
            <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:C.muted, fontWeight:600, marginTop:1, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-[18px] items-start">

        {/* Dialer card */}
        <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:22, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
          {/* Lead hero */}
          <div style={{ padding:'24px 28px 20px', background:'linear-gradient(135deg,#F8FAFC,#EFF6FF)', borderBottom:`1px solid ${C.border}` }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
              <div style={{ width:60, height:60, borderRadius:18, background:'linear-gradient(135deg,#2563EB,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:800, color:'#fff', flexShrink:0 }}>
                {name.charAt(0)}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                  <h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0 }}>{name}</h2>
                  <ScorePill score={current.intentScore}/>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:17, fontWeight:800, color:C.blue }}>{phone || 'No number'}</span>
                  <button onClick={copyPhone} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 9px', border:`1px solid ${C.border}`, borderRadius:6, background:C.panel, color:copied ? C.emerald : C.label, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    {copied ? <><Check size={10}/>Copied</> : <><Copy size={10}/>Copy</>}
                  </button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {current.city && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:C.muted, background:C.bg, border:`1px solid ${C.border}`, borderRadius:20, padding:'3px 10px' }}><MapPin size={11}/>{current.city}</span>}
                  {current.propertyType?.[0] && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:C.muted, background:C.bg, border:`1px solid ${C.border}`, borderRadius:20, padding:'3px 10px' }}><Home size={11}/>{current.propertyType[0]}</span>}
                  {budget && <span style={{ fontSize:12, fontWeight:600, color:C.emerald, background:C.emeraldDim, border:`1px solid #A7F3D0`, borderRadius:20, padding:'3px 10px' }}>{budget}</span>}
                  {current.sourcePortal && <span style={{ fontSize:11, fontWeight:700, background:C.blueDim, color:C.blue, borderRadius:20, padding:'3px 10px' }}>{current.sourcePortal}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div style={{ padding:'22px 28px' }}>
              {/* Mode row */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, marginBottom:16 }}>
                <span style={{ fontSize:11, color:C.muted }}>Calling via: <strong style={{ color:C.text }}>{CALL_MODES.find(m=>m.id===callMode)?.label}</strong></span>
                <button onClick={() => { setSessionOn(false); setStep(1) }} style={{ fontSize:11, color:C.blue, border:'none', background:'none', cursor:'pointer', fontWeight:600 }}>Change mode</button>
              </div>

              {callMode === 'corporate' && (
                <>
                  <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:12, padding:'12px 16px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <p style={{ fontSize:10, fontWeight:700, color:'#15803D', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Dial from work phone</p>
                      <p style={{ fontSize:20, fontWeight:800, color:C.text, margin:0 }}>{formatIndianPhone(phone) || '—'}</p>
                    </div>
                    <button onClick={copyPhone} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', border:`1px solid #86EFAC`, borderRadius:9, background:'#fff', color:'#15803D', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      {copied ? <><Check size={10}/>Copied</> : <><Copy size={10}/>Copy</>}
                    </button>
                  </div>
                  <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                    <button onClick={startCall} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'13px 0', background:'linear-gradient(135deg,#059669,#047857)', borderRadius:13, color:'#fff', fontSize:15, fontWeight:800, border:'none', cursor:'pointer', boxShadow:'0 4px 14px rgba(5,150,105,0.3)' }}>
                      <PhoneCall size={16}/> I&apos;m calling — start timer
                    </button>
                    {phone && <a href={waLink(phone)} target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', gap:8, padding:'13px 16px', background:'#DCFCE7', border:`1px solid #86EFAC`, borderRadius:13, color:'#15803D', fontSize:14, fontWeight:700, textDecoration:'none' }}><MessageCircle size={15}/> WhatsApp</a>}
                  </div>
                </>
              )}

              {callMode === 'internet' && (
                <div style={{ background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:14, padding:'20px', textAlign:'center', marginBottom:12 }}>
                  <Globe size={24} color="#7C3AED" style={{ marginBottom:8 }}/>
                  <p style={{ fontSize:13, fontWeight:700, color:'#7C3AED', margin:'0 0 4px' }}>Telephony provider not connected</p>
                  <p style={{ fontSize:12, color:C.muted, margin:'0 0 12px' }}>Connect Exotel or Twilio in Settings → Integrations.</p>
                  <button onClick={startCall} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', background:'#7C3AED', border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    <ClipboardList size={13}/> Log manually instead
                  </button>
                </div>
              )}

              {callMode === 'manual' && (
                <button onClick={startCall} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'14px 0', background:'linear-gradient(135deg,#059669,#047857)', borderRadius:13, color:'#fff', fontSize:15, fontWeight:800, border:'none', cursor:'pointer', boxShadow:'0 4px 14px rgba(5,150,105,0.3)', marginBottom:12, width:'100%' }}>
                  <ClipboardList size={16}/> Log this call outcome
                </button>
              )}

              <button onClick={skip} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px 0', background:'transparent', border:'none', color:C.label, fontSize:13, fontWeight:600, cursor:'pointer', width:'100%' }}>
                <SkipForward size={13}/> Skip this lead
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div style={{ padding:'32px 28px', textAlign:'center' }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.emerald, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Call in progress</div>
              <div style={{ fontSize:48, fontWeight:800, color:C.text, fontVariantNumeric:'tabular-nums' }}>{fmtTime(elapsed)}</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, margin:'10px 0 24px' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:C.emerald, animation:'pulse 1.5s infinite' }}/>
                <span style={{ fontSize:13, color:C.muted }}>Calling {phone}</span>
              </div>
              <button onClick={() => setStep(3)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px 28px', background:C.red, border:'none', borderRadius:14, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', margin:'0 auto', boxShadow:'0 4px 14px rgba(239,68,68,0.25)' }}>
                <PhoneOff size={16}/> Call Ended — Log It
              </button>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div style={{ padding:'22px 28px' }}>
              <p style={{ fontSize:12, fontWeight:700, color:C.label, textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 12px' }}>How did the call go?</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                {OUTCOMES.map(o => {
                  const Icon = o.icon
                  const sel  = outcome === o.id
                  return (
                    <button key={o.id} onClick={() => setOutcome(o.id)}
                      style={{ display:'flex', alignItems:'center', gap:9, padding:'12px 14px', borderRadius:12, border:`2px solid ${sel ? o.color : C.border}`, background: sel ? o.dim : C.bg, color: sel ? o.color : C.muted, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                      <Icon size={15}/> {o.label}
                    </button>
                  )
                })}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Quick note (optional)…"
                style={{ width:'100%', padding:'10px 12px', border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, color:C.text, resize:'none', minHeight:56, outline:'none', boxSizing:'border-box', marginBottom:12, background:C.bg }}/>
              <button onClick={logAndNext} disabled={!outcome}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px 0', background:!outcome ? C.borderDim : (outMeta?.color ?? C.blue), border:'none', borderRadius:13, color:!outcome ? C.label : '#fff', fontSize:14, fontWeight:800, cursor:!outcome ? 'not-allowed' : 'pointer' }}>
                Log &amp; Next <ChevronRight size={16}/>
              </button>
              {elapsed > 0 && <p style={{ fontSize:11, color:C.label, textAlign:'center', margin:'8px 0 0' }}>Duration: {fmtTime(elapsed)}</p>}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:18, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, fontWeight:700, color:C.text }}>Today&apos;s calls</span>
              <span style={{ fontSize:11, fontWeight:700, color:C.blue, background:C.blueDim, borderRadius:20, padding:'2px 8px' }}>{log.length}</span>
            </div>
            <div style={{ maxHeight:220, overflowY:'auto' }}>
              {log.length === 0
                ? <div style={{ padding:'20px 16px', textAlign:'center', fontSize:12, color:C.label }}>No calls yet</div>
                : log.map((c,i) => {
                    const o = OUTCOMES.find(x => x.id === c.outcome)
                    return (
                      <div key={i} style={{ padding:'9px 16px', borderBottom:`1px solid ${C.borderDim}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{c.leadName}</div>
                          <div style={{ fontSize:10, color:C.label }}>{fmtTime(c.duration)}</div>
                        </div>
                        {o && <span style={{ fontSize:10, fontWeight:800, background:o.dim, color:o.color, borderRadius:20, padding:'2px 8px' }}>{o.emoji} {o.label}</span>}
                      </div>
                    )
                  })
              }
            </div>
          </div>

          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:18, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, fontSize:13, fontWeight:700, color:C.text }}>Up next</div>
            <div style={{ maxHeight:300, overflowY:'auto' }}>
              {leads.slice(queueIdx+1, queueIdx+8).map((lead,i) => (
                <div key={lead.id} style={{ padding:'10px 16px', borderBottom:`1px solid ${C.borderDim}`, display:'flex', justifyContent:'space-between', alignItems:'center', opacity: Math.max(0.3, 1-i*0.1) }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:C.blueDim, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:C.blue, flexShrink:0 }}>{lead.name.firstName.charAt(0)}</div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{fname(lead)}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ fontSize:9, fontWeight:700, color:'#64748B', background:'#F1F5F9', border:'1px solid #E2E8F0', padding:'1px 5px', borderRadius:4, fontFamily:'monospace', letterSpacing:'0.04em' }}>{getCsId(lead)}</span>
                        <span style={{ fontSize:10, color:C.label }}>{lead.city ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                  <ScorePill score={lead.intentScore}/>
                </div>
              ))}
              {queueIdx+1 >= leads.length && (
                <div style={{ padding:'14px 16px', textAlign:'center' }}>
                  <Star size={14} color={C.emerald} style={{ display:'block', margin:'0 auto 4px' }}/>
                  <span style={{ fontSize:12, color:C.muted }}>Last lead in queue</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
      `}</style>
    </div>
  )
}
