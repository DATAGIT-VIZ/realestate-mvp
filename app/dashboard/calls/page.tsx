'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PhoneCall, PhoneOff, PhoneMissed, SkipForward,
  CheckCircle, MapPin, Home, Loader2, RotateCcw,
  MessageCircle, Star, ChevronRight, Trophy, Copy, Check,
  Flame, Thermometer, Snowflake, Clock, Phone, List,
} from 'lucide-react'

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
  const [sessionOn, setSessionOn] = useState(false)
  const [showLog,   setShowLog]   = useState(false)
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

  const startCall = () => {
    setStep(2)
    setElapsed(0)
    if (phone) {
      const a = document.createElement('a')
      a.href = `tel:${phone}`
      a.click()
    }
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

          {/* Activation banner */}
          <div style={{ background:'linear-gradient(135deg,rgba(124,58,237,0.06),rgba(37,99,235,0.04))', border:'1px solid rgba(124,58,237,0.2)', borderRadius:14, padding:'14px 18px', marginBottom:16, display:'flex', gap:12, alignItems:'flex-start' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#2563EB)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Phone size={15} color="#fff"/>
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:'#7C3AED', margin:'0 0 3px' }}>Full Browser Calling — Available on Demand</p>
              <p style={{ fontSize:12, color:C.muted, margin:0, lineHeight:1.6 }}>
                We can activate <strong style={{ color:C.text }}>WebRTC + Exotel</strong> for you — one-click dialling directly from the browser, auto call recording, live whisper coaching, and no SIM needed. <span style={{ color:'#7C3AED', fontWeight:600 }}>Reach out to enable for your team.</span>
              </p>
            </div>
          </div>

          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:20, padding: isMobile?'18px 16px':'22px 24px', marginBottom:16 }}>
            {[
              { n:'1', title:'Tap "Call"',         desc:'Your phone dialler opens with the number already filled in — just tap the green call button.', color:C.blue    },
              { n:'2', title:'Talk from your SIM', desc:'Use your own phone, no extra cost, no setup needed. Works anywhere with signal.', color:C.emerald },
              { n:'3', title:'Log in 3 taps',      desc:'Mark outcome, add a note, tap Log & Next. The next lead loads automatically.', color:C.violet  },
            ].map(s => (
              <div key={s.n} style={{ display:'flex', gap:14, marginBottom:14, alignItems:'flex-start' }}>
                <div style={{ width:32, height:32, borderRadius:10, background:`${s.color}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:14, fontWeight:800, color:s.color }}>{s.n}</span>
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{s.title}</div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

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
            {/* Phone number */}
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:20, fontWeight:800, color:C.text, letterSpacing:'0.02em' }}>{phone || '—'}</span>
              <button onClick={copyPhone} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', border:`1px solid ${C.border}`, borderRadius:9, background:copied ? C.emeraldDim : C.bg, color:copied ? C.emerald : C.muted, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                {copied ? <><Check size={12}/>Copied!</> : <><Copy size={12}/>Copy</>}
              </button>
            </div>
          </div>

          {/* Step 1 — call actions */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <a href={phone ? `tel:${phone}` : undefined}
                onClick={e => { if (!phone) e.preventDefault(); else startCall() }}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'20px 0', background: phone ? 'linear-gradient(135deg,#059669,#047857)' : '#E2E8F0', borderRadius:18, color: phone ? '#fff' : C.label, fontSize:18, fontWeight:800, textDecoration:'none', boxShadow: phone ? '0 6px 20px rgba(5,150,105,0.35)' : 'none', cursor: phone ? 'pointer' : 'not-allowed' }}>
                <PhoneCall size={22}/> Call {name.split(' ')[0]}
              </a>
              {phone && (
                <a href={waLink(phone)} target="_blank" rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'16px 0', background:'#DCFCE7', border:`1.5px solid #86EFAC`, borderRadius:16, color:'#15803D', fontSize:16, fontWeight:700, textDecoration:'none' }}>
                  <MessageCircle size={18}/> Message on WhatsApp
                </a>
              )}
              <button onClick={skip} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'13px 0', background:'transparent', border:`1px solid ${C.border}`, borderRadius:14, color:C.label, fontSize:14, fontWeight:600, cursor:'pointer' }}>
                <SkipForward size={14}/> Skip this lead
              </button>
              <p style={{ fontSize:11, color:C.label, textAlign:'center', margin:'4px 0 0', lineHeight:1.6 }}>
                Tap <strong style={{ color:C.text }}>Call</strong> — your phone dialler opens with the number already filled in.
              </p>
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
              <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                <a href={phone ? `tel:${phone}` : undefined}
                  onClick={e => { if (!phone) e.preventDefault(); else startCall() }}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'14px 0', background: phone ? 'linear-gradient(135deg,#059669,#047857)' : '#E2E8F0', borderRadius:14, color: phone ? '#fff' : C.label, fontSize:16, fontWeight:800, textDecoration:'none', boxShadow: phone ? '0 4px 16px rgba(5,150,105,0.3)' : 'none', cursor: phone ? 'pointer' : 'not-allowed' }}>
                  <PhoneCall size={18}/> Call {name.split(' ')[0]}
                </a>
                {phone && (
                  <a href={waLink(phone)} target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'14px 18px', background:'#DCFCE7', border:`1px solid #86EFAC`, borderRadius:14, color:'#15803D', fontSize:14, fontWeight:700, textDecoration:'none' }}>
                    <MessageCircle size={16}/> WhatsApp
                  </a>
                )}
              </div>
              <button onClick={skip} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 0', background:'transparent', border:'none', color:C.label, fontSize:13, fontWeight:600, cursor:'pointer', width:'100%' }}>
                <SkipForward size={13}/> Skip this lead
              </button>
              <p style={{ fontSize:11, color:C.label, textAlign:'center', margin:'8px 0 0' }}>
                Click <strong style={{ color:C.text }}>Call</strong> to open your phone dialler with the number pre-filled · or use <strong style={{ color:C.text }}>Copy</strong> to dial manually
              </p>
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
