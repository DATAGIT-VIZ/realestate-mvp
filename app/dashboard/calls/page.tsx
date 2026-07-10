'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PhoneCall, PhoneOff, PhoneMissed, SkipForward,
  CheckCircle, MapPin, Home, Loader2, RotateCcw,
  MessageCircle, Star, ChevronRight, Trophy, Copy, Check,
  Flame, Thermometer, Snowflake, Clock, Phone, List,
} from 'lucide-react'

const BG     = '#F8FAFC'
const PANEL  = '#FFFFFF'
const BORDER = '#E2E8F0'
const TEXT   = '#0F172A'
const MUTED  = '#64748B'
const LABEL  = '#94A3B8'
const BLUE   = '#2563EB'
const BLUE_D = '#EFF6FF'
const GREEN  = '#059669'
const GREEN_D= '#ECFDF5'
const AMBER  = '#D97706'
const AMBER_D= '#FFFBEB'
const RED    = '#EF4444'
const RED_D  = '#FFF1F2'

function formatIndianPhone(raw: string) {
  const d = raw.replace(/\D/g, '')
  const n = d.startsWith('91') && d.length === 12 ? d.slice(2) : d
  if (n.length === 10) return `+91 ${n.slice(0,5)} ${n.slice(5)}`
  return raw
}

const OUTCOMES = [
  { id: 'connected',      label: 'Connected',      icon: CheckCircle, color: GREEN, dim: GREEN_D, emoji: '✅' },
  { id: 'no_answer',      label: 'No Answer',      icon: PhoneMissed, color: AMBER, dim: AMBER_D, emoji: '📵' },
  { id: 'callback',       label: 'Call Back',      icon: Clock,       color: BLUE,  dim: BLUE_D,  emoji: '🔁' },
  { id: 'not_interested', label: 'Not Interested', icon: PhoneOff,    color: RED,   dim: RED_D,   emoji: '❌' },
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

interface CallLog { leadName: string; phone: string; outcome: string; note: string; duration: number }

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
  return `https://wa.me/${c.startsWith('91') ? c : `91${c.replace(/^0/,'')}`}`
}

function ScoreBadge({ score }: { score?: number|null }) {
  if (!score) return null
  const hot = score >= 75, warm = score >= 50
  const Icon  = hot ? Flame : warm ? Thermometer : Snowflake
  const color = hot ? '#EA580C' : warm ? AMBER : '#475569'
  const bg    = hot ? '#FFF7ED' : warm ? AMBER_D : '#F1F5F9'
  const label = hot ? 'Hot' : warm ? 'Warm' : 'New'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, background:bg, color, borderRadius:6, padding:'3px 8px', border:`1px solid ${color}25` }}>
      <Icon size={11}/>{label} · {score}
    </span>
  )
}

function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const check = () => setM(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return m
}

export default function PowerDialerPage() {
  const isMobile = useIsMobile()
  const [leads,      setLeads]      = useState<Lead[]>([])
  const [loading,    setLoading]    = useState(true)
  const [queueIdx,   setQueueIdx]   = useState(0)
  const [step,       setStep]       = useState<1|2|3>(1)
  const [elapsed,    setElapsed]    = useState(0)
  const [outcome,    setOutcome]    = useState('')
  const [note,       setNote]       = useState('')
  const [log,        setLog]        = useState<CallLog[]>([])
  const [stats,      setStats]      = useState({ total:0, connected:0, skipped:0 })
  const [copied,     setCopied]     = useState(false)
  const [csidCopied, setCsidCopied] = useState(false)
  const [sessionOn,  setSessionOn]  = useState(false)
  const [showLog,    setShowLog]    = useState(false)
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
    if (step === 2) { timerRef.current = setInterval(() => setElapsed(e => e+1), 1000) }
    else { if (timerRef.current) clearInterval(timerRef.current) }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [step])

  const current = leads[queueIdx]
  const phone   = current?.phones?.primaryPhoneNumber ?? ''
  const name    = current ? fname(current) : ''
  const budget  = current ? fmtBudget(current.budgetMin, current.budgetMax) : null
  const outMeta = OUTCOMES.find(o => o.id === outcome)
  const csId    = current ? getCsId(current) : ''

  const copyPhone = () => { navigator.clipboard.writeText(phone); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const copyCsId  = () => { if (!csId) return; navigator.clipboard.writeText(csId); setCsidCopied(true); setTimeout(() => setCsidCopied(false), 2000) }

  const startCall = () => {
    setStep(2); setElapsed(0)
    if (phone) { const a = document.createElement('a'); a.href = `tel:${phone}`; a.click() }
  }
  const logAndNext = () => {
    if (!outcome) return
    setLog(prev => [{ leadName:name, phone, outcome, note, duration:elapsed }, ...prev])
    setStats(s => ({ ...s, total:s.total+1, connected:s.connected+(outcome==='connected'?1:0) }))
    setOutcome(''); setNote(''); setElapsed(0); setStep(1); setQueueIdx(i => i+1)
  }
  const skip = () => {
    setStats(s => ({ ...s, total:s.total+1, skipped:s.skipped+1 }))
    setOutcome(''); setNote(''); setElapsed(0); setStep(1); setQueueIdx(i => i+1)
  }
  const restart = () => { setQueueIdx(0); setStats({total:0,connected:0,skipped:0}); setStep(1); setSessionOn(false) }
  const connectRate = stats.total ? Math.round(stats.connected/stats.total*100) : 0

  // ── Welcome ────────────────────────────────────────────────────────────
  if (!sessionOn) {
    return (
      <div style={{ minHeight:'100vh', background:BG, padding: isMobile ? '28px 16px' : '36px 28px' }}>
        <div style={{ maxWidth:520, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:BLUE_D, border:`1px solid ${BLUE}25`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Phone size={18} color={BLUE}/>
            </div>
            <div>
              <h1 style={{ fontSize:20, fontWeight:800, color:TEXT, margin:0, letterSpacing:'-0.01em' }}>Power Dialer</h1>
              <p style={{ fontSize:13, color:MUTED, margin:0 }}>Hottest leads first · 3 taps per call</p>
            </div>
          </div>

          {!loading && leads.length > 0 && (
            <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:16, overflow:'hidden', marginBottom:16 }}>
              <div style={{ padding:'11px 16px', borderBottom:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, fontWeight:600, color:MUTED }}>{leads.length} leads in queue</span>
                <span style={{ fontSize:11, color:LABEL }}>Sorted by score ↓</span>
              </div>
              {leads.slice(0,5).map((l, i) => (
                <div key={l.id} style={{ padding:'10px 16px', borderBottom: i < 4 ? `1px solid ${BORDER}` : 'none', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:9, background:BLUE_D, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:BLUE, flexShrink:0 }}>
                    {l.name.firstName.charAt(0)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:TEXT }}>{fname(l)}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:1 }}>
                      <span style={{ fontSize:9, fontWeight:700, color:MUTED, background:'#F1F5F9', border:`1px solid ${BORDER}`, padding:'1px 5px', borderRadius:4, fontFamily:'monospace' }}>{getCsId(l)}</span>
                      {l.city && <span style={{ fontSize:11, color:LABEL }}>{l.city}</span>}
                    </div>
                  </div>
                  <ScoreBadge score={l.intentScore}/>
                </div>
              ))}
              {leads.length > 5 && (
                <div style={{ padding:'9px 16px', textAlign:'center', fontSize:12, color:LABEL, background:BG, borderTop:`1px solid ${BORDER}` }}>
                  +{leads.length-5} more
                </div>
              )}
            </div>
          )}

          {loading
            ? <div style={{ textAlign:'center', padding:32, color:MUTED }}><Loader2 size={20} style={{ animation:'spin 1s linear infinite', display:'block', margin:'0 auto 10px' }}/> Loading leads…</div>
            : <button onClick={() => setSessionOn(true)} style={{ width:'100%', padding:'14px 0', background:GREEN, border:'none', borderRadius:12, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:9 }}>
                <PhoneCall size={17}/> Start Dialing Session
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
      <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ textAlign:'center', maxWidth:380 }}>
          <div style={{ width:72, height:72, borderRadius:20, background:GREEN_D, border:`1px solid ${GREEN}30`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
            <Trophy size={32} color={GREEN}/>
          </div>
          <h2 style={{ fontSize:22, fontWeight:800, color:TEXT, margin:'0 0 6px', letterSpacing:'-0.01em' }}>Session complete</h2>
          <p style={{ fontSize:13, color:MUTED, margin:'0 0 24px' }}>You worked through the full queue.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
            {[
              { label:'Dialed',    value:stats.total,      color:BLUE  },
              { label:'Connected', value:stats.connected,  color:GREEN },
              { label:'Rate',      value:`${connectRate}%`,color:'#7C3AED' },
            ].map(s => (
              <div key={s.label} style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:12, padding:'14px 10px' }}>
                <div style={{ fontSize:22, fontWeight:800, color:s.color, letterSpacing:'-0.01em' }}>{s.value}</div>
                <div style={{ fontSize:10, color:MUTED, marginTop:2, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <button onClick={restart} style={{ width:'100%', padding:'13px 0', background:TEXT, border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
            Start New Session
          </button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── MOBILE ──────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight:'100vh', background:BG, display:'flex', flexDirection:'column' }}>
        {/* Top bar */}
        <div style={{ background:PANEL, borderBottom:`1px solid ${BORDER}`, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <span style={{ fontSize:13, fontWeight:700, color:TEXT }}>{queueIdx+1} / {leads.length}</span>
            <span style={{ fontSize:11, color:LABEL, marginLeft:8 }}>{leads.length-queueIdx-1} left</span>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, background:GREEN_D, color:GREEN, borderRadius:6, padding:'3px 10px', border:`1px solid ${GREEN}25` }}>
              {stats.connected} connected
            </span>
            <button onClick={() => setShowLog(v => !v)} style={{ padding:'6px 10px', border:`1px solid ${BORDER}`, borderRadius:8, background:PANEL, color:MUTED, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11 }}>
              <List size={13}/> Log
            </button>
          </div>
        </div>

        {/* Log drawer */}
        {showLog && (
          <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.3)' }} onClick={() => setShowLog(false)}>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, background:PANEL, borderRadius:'16px 16px 0 0', maxHeight:'70vh', overflow:'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding:'14px 18px', borderBottom:`1px solid ${BORDER}`, fontWeight:700, fontSize:14, color:TEXT, display:'flex', justifyContent:'space-between' }}>
                Today&apos;s calls ({log.length})
                <button onClick={() => setShowLog(false)} style={{ border:'none', background:'none', fontSize:20, color:LABEL, cursor:'pointer' }}>×</button>
              </div>
              {log.length === 0
                ? <div style={{ padding:24, textAlign:'center', fontSize:13, color:LABEL }}>No calls yet</div>
                : log.map((c,i) => {
                    const o = OUTCOMES.find(x => x.id === c.outcome)
                    return (
                      <div key={i} style={{ padding:'11px 18px', borderBottom:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:TEXT }}>{c.leadName}</div>
                          <div style={{ fontSize:11, color:LABEL }}>{fmtTime(c.duration)}</div>
                        </div>
                        {o && <span style={{ fontSize:11, fontWeight:700, background:o.dim, color:o.color, borderRadius:6, padding:'3px 9px' }}>{o.emoji} {o.label}</span>}
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )}

        <div style={{ flex:1, padding:'16px 16px 100px', overflowY:'auto' }}>
          {/* Lead card */}
          <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:16, overflow:'hidden', marginBottom:12 }}>
            {/* Header */}
            <div style={{ padding:'18px 18px 14px', background:BG, borderBottom:`1px solid ${BORDER}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:48, height:48, borderRadius:14, background:BLUE_D, border:`1px solid ${BLUE}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, color:BLUE, flexShrink:0 }}>
                  {name.charAt(0)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <h2 style={{ fontSize:18, fontWeight:800, color:TEXT, margin:'0 0 5px', letterSpacing:'-0.01em' }}>{name}</h2>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <ScoreBadge score={current.intentScore}/>
                    {current.sourcePortal && <span style={{ fontSize:10, fontWeight:600, color:BLUE, background:BLUE_D, borderRadius:6, padding:'2px 7px' }}>{current.sourcePortal}</span>}
                  </div>
                </div>
              </div>
            </div>
            {/* Phone */}
            <div style={{ padding:'16px 18px', borderBottom:`1px solid ${BORDER}` }}>
              <div style={{ fontSize:10, fontWeight:700, color:LABEL, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Phone number</div>
              <div style={{ fontSize:24, fontWeight:800, color:TEXT, letterSpacing:'-0.01em', marginBottom:10, fontVariantNumeric:'tabular-nums' }}>
                {formatIndianPhone(phone) || '—'}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={copyPhone} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', border:`1px solid ${BORDER}`, borderRadius:7, background: copied ? GREEN_D : BG, color: copied ? GREEN : MUTED, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {copied ? <><Check size={11}/>Copied</> : <><Copy size={11}/>Copy</>}
                </button>
                {csId && (
                  <button onClick={copyCsId} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', border:`1px solid ${csidCopied ? GREEN+'40' : BORDER}`, borderRadius:7, background: csidCopied ? GREEN_D : BG, cursor:'pointer' }}>
                    <span style={{ fontSize:11, fontWeight:700, color: csidCopied ? GREEN : MUTED, fontFamily:'monospace', letterSpacing:'0.04em' }}>{csId}</span>
                    {csidCopied ? <Check size={10} color={GREEN}/> : <Copy size={10} color={LABEL}/>}
                  </button>
                )}
              </div>
            </div>
            {/* Context */}
            <div style={{ padding:'12px 18px', display:'flex', flexWrap:'wrap', gap:6 }}>
              {current.city && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:MUTED, background:BG, border:`1px solid ${BORDER}`, borderRadius:6, padding:'3px 9px' }}><MapPin size={10}/>{current.city}</span>}
              {current.propertyType?.[0] && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:MUTED, background:BG, border:`1px solid ${BORDER}`, borderRadius:6, padding:'3px 9px' }}><Home size={10}/>{current.propertyType[0]}</span>}
              {budget && <span style={{ fontSize:12, fontWeight:600, color:GREEN, background:GREEN_D, border:`1px solid ${GREEN}25`, borderRadius:6, padding:'3px 9px' }}>{budget}</span>}
            </div>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button onClick={startCall} disabled={!phone}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:9, padding:'16px 0', background: phone ? GREEN : BORDER, border:'none', borderRadius:12, color: phone ? '#fff' : LABEL, fontSize:16, fontWeight:800, cursor: phone ? 'pointer' : 'not-allowed' }}>
                <PhoneCall size={18}/> Call now
              </button>
              {phone && (
                <a href={waLink(phone)} target="_blank" rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:9, padding:'13px 0', background:PANEL, border:`1px solid ${BORDER}`, borderRadius:12, color:TEXT, fontSize:14, fontWeight:600, textDecoration:'none' }}>
                  <MessageCircle size={16} color="#25D366"/> WhatsApp
                </a>
              )}
              <button onClick={skip} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 0', background:'transparent', border:'none', color:LABEL, fontSize:13, fontWeight:500, cursor:'pointer' }}>
                <SkipForward size={13}/> Skip this lead
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:16, padding:'28px 20px', textAlign:'center' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:10 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:GREEN, animation:'pulse 1.5s infinite' }}/>
                <span style={{ fontSize:11, fontWeight:700, color:GREEN, textTransform:'uppercase', letterSpacing:'0.08em' }}>Call in progress</span>
              </div>
              <div style={{ fontSize:48, fontWeight:800, color:TEXT, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em', marginBottom:4 }}>{fmtTime(elapsed)}</div>
              <div style={{ fontSize:13, color:MUTED, marginBottom:22 }}>Calling {name.split(' ')[0]}</div>
              <button onClick={() => setStep(3)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:9, padding:'15px 0', background:RED, border:'none', borderRadius:12, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                <PhoneOff size={17}/> Call Ended — Log It
              </button>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:16, padding:'18px' }}>
              <p style={{ fontSize:13, fontWeight:700, color:TEXT, margin:'0 0 12px' }}>How did it go?</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                {OUTCOMES.map(o => {
                  const Icon = o.icon; const sel = outcome === o.id
                  return (
                    <button key={o.id} onClick={() => setOutcome(o.id)}
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7, padding:'16px 10px', borderRadius:12, border:`1.5px solid ${sel ? o.color : BORDER}`, background: sel ? o.dim : BG, color: sel ? o.color : MUTED, fontSize:12, fontWeight:700, cursor:'pointer', minHeight:72 }}>
                      <Icon size={18}/>{o.label}
                    </button>
                  )
                })}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Quick note (optional)…"
                style={{ width:'100%', padding:'10px 12px', border:`1px solid ${BORDER}`, borderRadius:10, fontSize:13, color:TEXT, resize:'none', minHeight:60, outline:'none', boxSizing:'border-box', marginBottom:10, background:BG }}/>
              <button onClick={logAndNext} disabled={!outcome}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'14px 0', background:!outcome ? BORDER : (outMeta?.color ?? BLUE), border:'none', borderRadius:12, color:!outcome ? LABEL : '#fff', fontSize:15, fontWeight:700, cursor:!outcome ? 'not-allowed' : 'pointer' }}>
                Log &amp; Next <ChevronRight size={16}/>
              </button>
              {elapsed > 0 && <p style={{ fontSize:11, color:LABEL, textAlign:'center', margin:'8px 0 0' }}>Duration: {fmtTime(elapsed)}</p>}
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin  { to { transform: rotate(360deg) } }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        `}</style>
      </div>
    )
  }

  // ── DESKTOP ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:BG, padding:'24px 28px' }}>

      {/* Page header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:BLUE_D, border:`1px solid ${BLUE}25`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Phone size={16} color={BLUE}/>
          </div>
          <div>
            <h1 style={{ fontSize:18, fontWeight:800, color:TEXT, margin:0, letterSpacing:'-0.01em' }}>Power Dialer</h1>
            <p style={{ fontSize:12, color:MUTED, margin:0 }}>Lead {queueIdx+1} of {leads.length} · {leads.length-queueIdx-1} remaining</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={loadLeads} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', border:`1px solid ${BORDER}`, borderRadius:8, background:PANEL, color:MUTED, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <RotateCcw size={12}/> Refresh
          </button>
          <button onClick={restart} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', border:`1px solid ${BORDER}`, borderRadius:8, background:PANEL, color:MUTED, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            End session
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Remaining', value:leads.length-queueIdx, color:BLUE   },
          { label:'Dialed',    value:stats.total,           color:TEXT   },
          { label:'Connected', value:stats.connected,       color:GREEN  },
          { label:'Rate',      value:`${connectRate}%`,     color:'#7C3AED' },
        ].map(s => (
          <div key={s.label} style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:22, fontWeight:800, color:s.color, letterSpacing:'-0.02em' }}>{s.value}</div>
            <div style={{ fontSize:10, color:MUTED, fontWeight:600, marginTop:2, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 296px', gap:16, alignItems:'start' }}>

        {/* Dialer card */}
        <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:18, overflow:'hidden' }}>

          {/* Lead header */}
          <div style={{ padding:'22px 24px 18px', background:BG, borderBottom:`1px solid ${BORDER}` }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
              <div style={{ width:52, height:52, borderRadius:15, background:BLUE_D, border:`1px solid ${BLUE}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color:BLUE, flexShrink:0 }}>
                {name.charAt(0)}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:7 }}>
                  <h2 style={{ fontSize:20, fontWeight:800, color:TEXT, margin:0, letterSpacing:'-0.01em' }}>{name}</h2>
                  <ScoreBadge score={current.intentScore}/>
                  {current.sourcePortal && <span style={{ fontSize:11, fontWeight:600, color:BLUE, background:BLUE_D, borderRadius:6, padding:'2px 8px' }}>{current.sourcePortal}</span>}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {current.city && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:MUTED, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:6, padding:'3px 9px' }}><MapPin size={10}/>{current.city}</span>}
                  {current.propertyType?.[0] && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:MUTED, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:6, padding:'3px 9px' }}><Home size={10}/>{current.propertyType[0]}</span>}
                  {budget && <span style={{ fontSize:12, fontWeight:600, color:GREEN, background:GREEN_D, border:`1px solid ${GREEN}25`, borderRadius:6, padding:'3px 9px' }}>{budget}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Phone hero */}
          <div style={{ padding:'20px 24px', borderBottom:`1px solid ${BORDER}` }}>
            <div style={{ fontSize:10, fontWeight:700, color:LABEL, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Phone number</div>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:28, fontWeight:800, color:TEXT, letterSpacing:'-0.01em', fontVariantNumeric:'tabular-nums' }}>
                {formatIndianPhone(phone) || '—'}
              </span>
              <div style={{ display:'flex', gap:7 }}>
                <button onClick={copyPhone} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', border:`1px solid ${BORDER}`, borderRadius:7, background: copied ? GREEN_D : BG, color: copied ? GREEN : MUTED, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {copied ? <><Check size={11}/>Copied</> : <><Copy size={11}/>Copy</>}
                </button>
                {csId && (
                  <button onClick={copyCsId} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', border:`1px solid ${csidCopied ? GREEN+'40' : BORDER}`, borderRadius:7, background: csidCopied ? GREEN_D : BG, cursor:'pointer' }}>
                    <span style={{ fontSize:11, fontWeight:700, color: csidCopied ? GREEN : MUTED, fontFamily:'monospace', letterSpacing:'0.05em' }}>{csId}</span>
                    {csidCopied ? <Check size={10} color={GREEN}/> : <Copy size={10} color={LABEL}/>}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 1 — actions */}
          {step === 1 && (
            <div style={{ padding:'18px 24px' }}>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={startCall} disabled={!phone}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:9, padding:'13px 0', background: phone ? GREEN : BORDER, border:'none', borderRadius:11, color: phone ? '#fff' : LABEL, fontSize:15, fontWeight:700, cursor: phone ? 'pointer' : 'not-allowed' }}>
                  <PhoneCall size={16}/> Call now
                </button>
                {phone && (
                  <a href={waLink(phone)} target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:7, padding:'13px 16px', background:PANEL, border:`1px solid ${BORDER}`, borderRadius:11, color:TEXT, fontSize:13, fontWeight:600, textDecoration:'none' }}>
                    <MessageCircle size={15} color="#25D366"/> WhatsApp
                  </a>
                )}
              </div>
              <button onClick={skip} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px 0', background:'transparent', border:'none', color:LABEL, fontSize:12, fontWeight:500, cursor:'pointer', width:'100%', marginTop:8 }}>
                <SkipForward size={13}/> Skip this lead
              </button>
            </div>
          )}

          {/* Step 2 — timer */}
          {step === 2 && (
            <div style={{ padding:'32px 24px', textAlign:'center', background:BG }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:10 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:GREEN, animation:'pulse 1.5s infinite' }}/>
                <span style={{ fontSize:11, fontWeight:700, color:GREEN, textTransform:'uppercase', letterSpacing:'0.08em' }}>Call in progress</span>
              </div>
              <div style={{ fontSize:46, fontWeight:800, color:TEXT, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em', marginBottom:4 }}>{fmtTime(elapsed)}</div>
              <div style={{ fontSize:13, color:MUTED, marginBottom:22 }}>Calling {phone}</div>
              <button onClick={() => setStep(3)}
                style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px', background:RED, border:'none', borderRadius:11, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                <PhoneOff size={15}/> Call Ended — Log It
              </button>
            </div>
          )}

          {/* Step 3 — log */}
          {step === 3 && (
            <div style={{ padding:'20px 24px' }}>
              <p style={{ fontSize:12, fontWeight:700, color:MUTED, textTransform:'uppercase', letterSpacing:'0.07em', margin:'0 0 12px' }}>How did the call go?</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                {OUTCOMES.map(o => {
                  const Icon = o.icon; const sel = outcome === o.id
                  return (
                    <button key={o.id} onClick={() => setOutcome(o.id)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 13px', borderRadius:10, border:`1.5px solid ${sel ? o.color : BORDER}`, background: sel ? o.dim : BG, color: sel ? o.color : MUTED, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                      <Icon size={14}/>{o.label}
                    </button>
                  )
                })}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Quick note (optional)…"
                style={{ width:'100%', padding:'10px 12px', border:`1px solid ${BORDER}`, borderRadius:9, fontSize:13, color:TEXT, resize:'none', minHeight:52, outline:'none', boxSizing:'border-box', marginBottom:10, background:BG }}/>
              <button onClick={logAndNext} disabled={!outcome}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'12px 0', background:!outcome ? BORDER : (outMeta?.color ?? BLUE), border:'none', borderRadius:11, color:!outcome ? LABEL : '#fff', fontSize:14, fontWeight:700, cursor:!outcome ? 'not-allowed' : 'pointer' }}>
                Log &amp; Next <ChevronRight size={15}/>
              </button>
              {elapsed > 0 && <p style={{ fontSize:11, color:LABEL, textAlign:'center', margin:'8px 0 0' }}>Duration: {fmtTime(elapsed)}</p>}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Today's calls */}
          <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'11px 14px', borderBottom:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, fontWeight:700, color:MUTED, textTransform:'uppercase', letterSpacing:'0.05em' }}>Today&apos;s calls</span>
              <span style={{ fontSize:11, fontWeight:700, color:BLUE, background:BLUE_D, borderRadius:6, padding:'2px 8px' }}>{log.length}</span>
            </div>
            <div style={{ maxHeight:200, overflowY:'auto' }}>
              {log.length === 0
                ? <div style={{ padding:'18px 14px', textAlign:'center', fontSize:12, color:LABEL }}>No calls yet</div>
                : log.map((c,i) => {
                    const o = OUTCOMES.find(x => x.id === c.outcome)
                    return (
                      <div key={i} style={{ padding:'9px 14px', borderBottom:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:TEXT }}>{c.leadName}</div>
                          <div style={{ fontSize:10, color:LABEL }}>{fmtTime(c.duration)}</div>
                        </div>
                        {o && <span style={{ fontSize:10, fontWeight:700, background:o.dim, color:o.color, borderRadius:6, padding:'2px 7px' }}>{o.emoji} {o.label}</span>}
                      </div>
                    )
                  })
              }
            </div>
          </div>

          {/* Up next */}
          <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'11px 14px', borderBottom:`1px solid ${BORDER}`, fontSize:12, fontWeight:700, color:MUTED, textTransform:'uppercase', letterSpacing:'0.05em' }}>Up next</div>
            <div style={{ maxHeight:360, overflowY:'auto' }}>
              {leads.slice(queueIdx+1, queueIdx+9).map((lead, i) => (
                <div key={lead.id} style={{ padding:'9px 14px', borderBottom:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between', alignItems:'center', opacity: Math.max(0.4, 1-i*0.1) }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:BLUE_D, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:BLUE, flexShrink:0 }}>
                      {lead.name.firstName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:TEXT }}>{fname(lead)}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ fontSize:9, fontWeight:700, color:MUTED, background:'#F1F5F9', border:`1px solid ${BORDER}`, padding:'1px 5px', borderRadius:4, fontFamily:'monospace' }}>{getCsId(lead)}</span>
                        <span style={{ fontSize:10, color:LABEL }}>{lead.city ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                  <ScoreBadge score={lead.intentScore}/>
                </div>
              ))}
              {queueIdx+1 >= leads.length && (
                <div style={{ padding:'14px', textAlign:'center' }}>
                  <Star size={13} color={GREEN} style={{ display:'block', margin:'0 auto 4px' }}/>
                  <span style={{ fontSize:11, color:LABEL }}>Last lead in queue</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
