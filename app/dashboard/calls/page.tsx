'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PhoneCall, PhoneOff, PhoneMissed, SkipForward,
  CheckCircle, MapPin, Home, Loader2, RotateCcw,
  MessageCircle, Star, ChevronRight, Trophy, Copy, Check,
  Flame, Thermometer, Snowflake, Clock, Phone, List,
  TrendingUp, Zap,
} from 'lucide-react'

function formatIndianPhone(raw: string) {
  const d = raw.replace(/\D/g, '')
  const n = d.startsWith('91') && d.length === 12 ? d.slice(2) : d
  if (n.length === 10) return `+91 ${n.slice(0,5)} ${n.slice(5)}`
  return raw
}

const C = {
  bg:         '#F1F5F9',
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
  dark:       '#0F172A',
  darkCard:   '#1E293B',
  darkBorder: '#334155',
  darkText:   '#F8FAFC',
  darkMuted:  '#94A3B8',
}

const OUTCOMES = [
  { id: 'connected',      label: 'Connected',      icon: CheckCircle,  color: C.emerald, dim: C.emeraldDim, emoji: '✅' },
  { id: 'no_answer',      label: 'No Answer',      icon: PhoneMissed,  color: C.amber,   dim: C.amberDim,   emoji: '📵' },
  { id: 'callback',       label: 'Call Back',      icon: Clock,        color: C.blue,    dim: C.blueDim,    emoji: '🔁' },
  { id: 'not_interested', label: 'Not Interested', icon: PhoneOff,     color: C.red,     dim: C.redDim,     emoji: '❌' },
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
  const color = hot ? '#FCA5A5' : warm ? '#FCD34D' : '#93C5FD'
  const bg    = hot ? 'rgba(239,68,68,0.2)' : warm ? 'rgba(217,119,6,0.2)' : 'rgba(37,99,235,0.2)'
  const label = hot ? 'Hot' : warm ? 'Warm' : 'New'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:800, background:bg, color, borderRadius:20, padding:'3px 10px' }}>
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

  const startCall = () => {
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
      <div style={{ minHeight:'100vh', background:C.bg }}>
        {/* Hero banner */}
        <div style={{ background:'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', padding: isMobile ? '36px 20px 28px' : '48px 40px 36px' }}>
          <div style={{ maxWidth:560, margin:'0 auto', textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg,#3B82F6,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px', boxShadow:'0 0 0 8px rgba(59,130,246,0.15), 0 8px 32px rgba(37,99,235,0.4)' }}>
              <Phone size={28} color="#fff"/>
            </div>
            <h1 style={{ fontSize:isMobile?24:30, fontWeight:900, color:'#F8FAFC', margin:'0 0 10px', letterSpacing:'-0.02em' }}>Power Dialer</h1>
            <p style={{ fontSize:14, color:'#94A3B8', margin:'0 0 20px', lineHeight:1.7 }}>
              Work your hottest leads, fastest path to a conversation.
            </p>
            {!loading && leads.length > 0 && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(5,150,105,0.15)', border:'1px solid rgba(5,150,105,0.4)', borderRadius:20, padding:'6px 16px' }}>
                <Zap size={13} color="#34D399"/>
                <span style={{ fontSize:13, fontWeight:700, color:'#34D399' }}>{leads.length} leads ready to dial</span>
              </div>
            )}
          </div>
        </div>

        {/* Lead queue preview */}
        <div style={{ maxWidth:560, margin:'0 auto', padding: isMobile ? '20px 16px' : '24px 20px' }}>
          {!loading && leads.length > 0 && (
            <div style={{ background:C.panel, borderRadius:18, border:`1px solid ${C.border}`, overflow:'hidden', marginBottom:16, boxShadow:'0 4px 20px rgba(0,0,0,0.06)' }}>
              <div style={{ padding:'12px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Call queue · Hottest first</span>
                <TrendingUp size={14} color={C.blue}/>
              </div>
              {leads.slice(0,5).map((l, i) => {
                const hot = (l.intentScore ?? 0) >= 75
                const warm = (l.intentScore ?? 0) >= 50
                return (
                  <div key={l.id} style={{ padding:'11px 18px', borderBottom: i < 4 ? `1px solid ${C.borderDim}` : 'none', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:22, height:22, borderRadius:6, background: i===0 ? 'linear-gradient(135deg,#3B82F6,#7C3AED)' : C.bg, border:`1px solid ${i===0 ? 'transparent' : C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color: i===0 ? '#fff' : C.label, flexShrink:0 }}>
                      {i+1}
                    </div>
                    <div style={{ width:34, height:34, borderRadius:10, background: hot ? 'linear-gradient(135deg,#EF4444,#DC2626)' : warm ? 'linear-gradient(135deg,#F59E0B,#D97706)' : 'linear-gradient(135deg,#3B82F6,#2563EB)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff', flexShrink:0 }}>
                      {l.name.firstName.charAt(0)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:2 }}>{fname(l)}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:9, fontWeight:700, color:'#64748B', background:'#F1F5F9', border:'1px solid #E2E8F0', padding:'1px 5px', borderRadius:4, fontFamily:'monospace' }}>{getCsId(l)}</span>
                        {l.city && <span style={{ fontSize:11, color:C.label }}>{l.city}</span>}
                      </div>
                    </div>
                    <ScorePill score={l.intentScore}/>
                  </div>
                )
              })}
              {leads.length > 5 && (
                <div style={{ padding:'10px 18px', textAlign:'center', fontSize:12, color:C.label, background:C.bg, borderTop:`1px solid ${C.borderDim}` }}>
                  +{leads.length-5} more leads in queue
                </div>
              )}
            </div>
          )}
          {loading
            ? <div style={{ textAlign:'center', padding:32, color:C.muted }}><Loader2 size={22} style={{ animation:'spin 1s linear infinite', display:'block', margin:'0 auto 10px' }}/> Loading your leads…</div>
            : (
              <button onClick={() => setSessionOn(true)}
                style={{ width:'100%', padding:'18px 0', background:'linear-gradient(135deg,#059669,#047857)', border:'none', borderRadius:16, color:'#fff', fontSize:17, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 24px rgba(5,150,105,0.35)', display:'flex', alignItems:'center', justifyContent:'center', gap:10, letterSpacing:'-0.01em' }}>
                <PhoneCall size={20}/> Start Dialing Session
              </button>
            )
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
          <div style={{ width:88, height:88, borderRadius:26, background:'linear-gradient(135deg,#059669,#047857)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 8px 32px rgba(5,150,105,0.35)' }}>
            <Trophy size={40} color="#fff"/>
          </div>
          <h2 style={{ fontSize:26, fontWeight:900, color:C.text, margin:'0 0 8px', letterSpacing:'-0.02em' }}>Session complete!</h2>
          <p style={{ fontSize:14, color:C.muted, margin:'0 0 28px' }}>You worked through the entire queue. Nice work.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:28 }}>
            {[
              { label:'Dialed',    value:stats.total,      color:C.blue    },
              { label:'Connected', value:stats.connected,  color:C.emerald },
              { label:'Rate',      value:`${connectRate}%`,color:C.violet  },
            ].map(s => (
              <div key={s.label} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:16, padding:'18px 10px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize:28, fontWeight:900, color:s.color, letterSpacing:'-0.02em' }}>{s.value}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:3, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <button onClick={restart} style={{ width:'100%', padding:'16px 0', background:C.dark, border:'none', borderRadius:14, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
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
      <div style={{ minHeight:'100vh', background:C.dark, display:'flex', flexDirection:'column' }}>

        {/* Top bar */}
        <div style={{ padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <span style={{ fontSize:13, fontWeight:700, color:'#F8FAFC' }}>{queueIdx+1} / {leads.length}</span>
            <span style={{ fontSize:11, color:'#64748B', marginLeft:8 }}>{leads.length-queueIdx-1} left</span>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:700, background:'rgba(5,150,105,0.2)', color:'#34D399', borderRadius:20, padding:'3px 10px', border:'1px solid rgba(5,150,105,0.3)' }}>
              {stats.connected} connected
            </span>
            <button onClick={() => setShowLog(v => !v)} style={{ padding:'6px 10px', border:'1px solid #334155', borderRadius:8, background:'#1E293B', color:'#94A3B8', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11 }}>
              <List size={13}/> Log
            </button>
          </div>
        </div>

        {/* Call log drawer */}
        {showLog && (
          <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.6)' }} onClick={() => setShowLog(false)}>
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

        {/* Lead card — dark */}
        <div style={{ margin:'0 16px', background:'#1E293B', borderRadius:22, border:'1px solid #334155', overflow:'hidden', marginBottom:16 }}>
          <div style={{ padding:'22px 20px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
              <div style={{ width:56, height:56, borderRadius:18, background:'linear-gradient(135deg,#3B82F6,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:'#fff', flexShrink:0, boxShadow:'0 0 0 4px rgba(59,130,246,0.2)' }}>
                {name.charAt(0)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <h2 style={{ fontSize:20, fontWeight:800, color:'#F8FAFC', margin:'0 0 5px', letterSpacing:'-0.01em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</h2>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <ScorePill score={current.intentScore}/>
                  {current.sourcePortal && <span style={{ fontSize:10, fontWeight:700, color:'#93C5FD', background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.25)', borderRadius:20, padding:'2px 8px' }}>{current.sourcePortal}</span>}
                </div>
              </div>
            </div>

            {/* Phone hero */}
            <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'14px 16px', marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Phone</div>
              <div style={{ fontSize:26, fontWeight:900, color:'#F8FAFC', letterSpacing:'-0.01em', fontVariantNumeric:'tabular-nums', marginBottom:8 }}>
                {formatIndianPhone(phone) || '—'}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={copyPhone} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', border:'1px solid #334155', borderRadius:8, background: copied ? 'rgba(5,150,105,0.15)' : 'rgba(255,255,255,0.06)', color: copied ? '#34D399' : '#94A3B8', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {copied ? <><Check size={11}/>Copied!</> : <><Copy size={11}/>Copy</>}
                </button>
                {csId && (
                  <button onClick={copyCsId} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', border:`1px solid ${csidCopied ? 'rgba(5,150,105,0.4)' : '#334155'}`, borderRadius:8, background: csidCopied ? 'rgba(5,150,105,0.15)' : 'rgba(255,255,255,0.06)', cursor:'pointer' }}>
                    <span style={{ fontSize:11, fontWeight:700, color: csidCopied ? '#34D399' : '#64748B', fontFamily:'monospace', letterSpacing:'0.06em' }}>{csId}</span>
                    {csidCopied ? <Check size={10} color="#34D399"/> : <Copy size={10} color="#475569"/>}
                  </button>
                )}
              </div>
            </div>

            {/* Context tags */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {current.city && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#64748B', background:'rgba(255,255,255,0.05)', border:'1px solid #334155', borderRadius:20, padding:'3px 10px' }}><MapPin size={10}/>{current.city}</span>}
              {current.propertyType?.[0] && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#64748B', background:'rgba(255,255,255,0.05)', border:'1px solid #334155', borderRadius:20, padding:'3px 10px' }}><Home size={10}/>{current.propertyType[0]}</span>}
              {budget && <span style={{ fontSize:11, fontWeight:600, color:'#34D399', background:'rgba(5,150,105,0.12)', border:'1px solid rgba(5,150,105,0.25)', borderRadius:20, padding:'3px 10px' }}>{budget}</span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding:'0 16px', flex:1 }}>
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button onClick={startCall} disabled={!phone}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'18px 0', background: phone ? 'linear-gradient(135deg,#059669,#047857)' : '#1E293B', borderRadius:16, color: phone ? '#fff' : '#475569', fontSize:17, fontWeight:800, border:'none', cursor: phone ? 'pointer' : 'not-allowed', boxShadow: phone ? '0 6px 24px rgba(5,150,105,0.4)' : 'none', letterSpacing:'-0.01em' }}>
                <PhoneCall size={20}/> Call now
              </button>
              {phone && (
                <a href={waLink(phone)} target="_blank" rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'14px 0', background:'rgba(21,128,61,0.12)', border:'1.5px solid rgba(21,128,61,0.3)', borderRadius:14, color:'#34D399', fontSize:15, fontWeight:700, textDecoration:'none' }}>
                  <MessageCircle size={17}/> WhatsApp
                </a>
              )}
              <button onClick={skip} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'12px 0', background:'transparent', border:'1px solid #1E293B', borderRadius:14, color:'#475569', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                <SkipForward size={14}/> Skip
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ background:'#1E293B', border:'1px solid #334155', borderRadius:20, padding:'28px 20px', textAlign:'center' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:12 }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:'#34D399', animation:'pulse 1.5s infinite' }}/>
                <span style={{ fontSize:12, fontWeight:700, color:'#34D399', textTransform:'uppercase', letterSpacing:'0.08em' }}>Live call</span>
              </div>
              <div style={{ fontSize:54, fontWeight:900, color:'#F8FAFC', fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em', marginBottom:6 }}>{fmtTime(elapsed)}</div>
              <div style={{ fontSize:13, color:'#64748B', marginBottom:24 }}>Calling {name.split(' ')[0]}</div>
              <button onClick={() => setStep(3)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'16px 0', background:'linear-gradient(135deg,#EF4444,#DC2626)', border:'none', borderRadius:14, color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 16px rgba(239,68,68,0.4)' }}>
                <PhoneOff size={18}/> Call Ended — Log It
              </button>
            </div>
          )}

          {step === 3 && (
            <div style={{ background:'#1E293B', border:'1px solid #334155', borderRadius:20, padding:'20px 18px' }}>
              <p style={{ fontSize:13, fontWeight:700, color:'#F8FAFC', margin:'0 0 14px' }}>How did it go?</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                {OUTCOMES.map(o => {
                  const Icon = o.icon
                  const sel  = outcome === o.id
                  return (
                    <button key={o.id} onClick={() => setOutcome(o.id)}
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, padding:'16px 10px', borderRadius:14, border:`2px solid ${sel ? o.color : '#334155'}`, background: sel ? `${o.color}18` : 'rgba(255,255,255,0.03)', color: sel ? o.color : '#64748B', fontSize:13, fontWeight:700, cursor:'pointer', minHeight:76 }}>
                      <Icon size={20}/>
                      {o.label}
                    </button>
                  )
                })}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Quick note (optional)…"
                style={{ width:'100%', padding:'12px 14px', border:'1px solid #334155', borderRadius:12, fontSize:14, color:'#F8FAFC', resize:'none', minHeight:64, outline:'none', boxSizing:'border-box', marginBottom:12, background:'rgba(255,255,255,0.04)' }}/>
              <button onClick={logAndNext} disabled={!outcome}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'16px 0', background:!outcome ? '#1E293B' : (outMeta?.color ?? C.blue), border:`1px solid ${!outcome ? '#334155' : 'transparent'}`, borderRadius:14, color:!outcome ? '#475569' : '#fff', fontSize:16, fontWeight:800, cursor:!outcome ? 'not-allowed' : 'pointer' }}>
                Log &amp; Next <ChevronRight size={17}/>
              </button>
              {elapsed > 0 && <p style={{ fontSize:11, color:'#475569', textAlign:'center', margin:'10px 0 0' }}>Duration: {fmtTime(elapsed)}</p>}
            </div>
          )}
        </div>

        <div style={{ height:32 }}/>
        <style>{`
          @keyframes spin  { to { transform: rotate(360deg) } }
          @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        `}</style>
      </div>
    )
  }

  // ── DESKTOP active session ─────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>

      {/* Dark top bar */}
      <div style={{ background:'linear-gradient(135deg, #0F172A, #1E293B)', padding:'14px 28px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <span style={{ fontSize:14, fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.01em' }}>Power Dialer</span>
          <span style={{ fontSize:12, color:'#475569', marginLeft:12 }}>Lead {queueIdx+1} of {leads.length} · {leads.length-queueIdx-1} remaining</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={loadLeads} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', border:'1px solid #334155', borderRadius:9, background:'rgba(255,255,255,0.05)', color:'#94A3B8', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <RotateCcw size={12}/> Refresh
          </button>
          <button onClick={restart} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', border:'1px solid #334155', borderRadius:9, background:'rgba(255,255,255,0.05)', color:'#94A3B8', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            End session
          </button>
        </div>
      </div>

      {/* Scoreboard */}
      <div style={{ background:C.dark, padding:'0 28px 16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {[
            { label:'Remaining', value:leads.length-queueIdx, color:'#93C5FD', dim:'rgba(59,130,246,0.12)' },
            { label:'Dialed',    value:stats.total,           color:'#F8FAFC',  dim:'rgba(255,255,255,0.06)' },
            { label:'Connected', value:stats.connected,       color:'#34D399',  dim:'rgba(5,150,105,0.12)' },
            { label:'Rate',      value:`${connectRate}%`,     color:'#C4B5FD',  dim:'rgba(124,58,237,0.12)' },
          ].map(s => (
            <div key={s.label} style={{ background:s.dim, border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'12px 16px' }}>
              <div style={{ fontSize:22, fontWeight:900, color:s.color, letterSpacing:'-0.02em' }}>{s.value}</div>
              <div style={{ fontSize:10, color:'#475569', fontWeight:700, marginTop:2, textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding:'18px 28px 28px', display:'grid', gridTemplateColumns:'1fr 300px', gap:18, alignItems:'start' }}>

        {/* Dialer card */}
        <div style={{ borderRadius:22, overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.12)', border:'1px solid #334155' }}>

          {/* Dark lead header */}
          <div style={{ background:'linear-gradient(160deg, #0F172A 0%, #1E293B 100%)', padding:'26px 28px 22px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
              <div style={{ width:60, height:60, borderRadius:18, background:'linear-gradient(135deg,#3B82F6,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:900, color:'#fff', flexShrink:0, boxShadow:'0 0 0 5px rgba(59,130,246,0.2), 0 4px 16px rgba(37,99,235,0.4)' }}>
                {name.charAt(0)}
              </div>
              <div style={{ flex:1 }}>
                <h2 style={{ fontSize:22, fontWeight:900, color:'#F8FAFC', margin:'0 0 8px', letterSpacing:'-0.02em' }}>{name}</h2>
                <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
                  <ScorePill score={current.intentScore}/>
                  {current.sourcePortal && <span style={{ fontSize:11, fontWeight:700, color:'#93C5FD', background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.25)', borderRadius:20, padding:'2px 9px' }}>{current.sourcePortal}</span>}
                  {current.city && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#64748B' }}><MapPin size={10}/>{current.city}</span>}
                  {current.propertyType?.[0] && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#64748B' }}><Home size={10}/>{current.propertyType[0]}</span>}
                  {budget && <span style={{ fontSize:12, fontWeight:600, color:'#34D399' }}>{budget}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Phone hero — white */}
          <div style={{ background:'#fff', padding:'22px 28px', borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.label, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Contact</div>
            <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
              <span style={{ fontSize:30, fontWeight:900, color:C.dark, letterSpacing:'-0.01em', fontVariantNumeric:'tabular-nums' }}>
                {formatIndianPhone(phone) || '—'}
              </span>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={copyPhone} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', border:`1px solid ${C.border}`, borderRadius:8, background: copied ? C.emeraldDim : C.bg, color: copied ? C.emerald : C.muted, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {copied ? <><Check size={11}/>Copied</> : <><Copy size={11}/>Copy</>}
                </button>
                {csId && (
                  <button onClick={copyCsId} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', border:`1px solid ${csidCopied ? '#A7F3D0' : C.border}`, borderRadius:8, background: csidCopied ? C.emeraldDim : C.bg, cursor:'pointer' }}>
                    <span style={{ fontSize:11, fontWeight:700, color: csidCopied ? C.emerald : '#475569', fontFamily:'monospace', letterSpacing:'0.05em' }}>{csId}</span>
                    {csidCopied ? <Check size={10} color={C.emerald}/> : <Copy size={10} color="#94A3B8"/>}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 1 — actions */}
          {step === 1 && (
            <div style={{ background:C.bg, padding:'20px 28px' }}>
              <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                <button onClick={startCall} disabled={!phone}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'15px 0', background: phone ? 'linear-gradient(135deg,#059669,#047857)' : '#E2E8F0', borderRadius:14, color: phone ? '#fff' : C.label, fontSize:16, fontWeight:800, border:'none', cursor: phone ? 'pointer' : 'not-allowed', boxShadow: phone ? '0 4px 18px rgba(5,150,105,0.35)' : 'none', letterSpacing:'-0.01em' }}>
                  <PhoneCall size={17}/> Call now
                </button>
                {phone && (
                  <a href={waLink(phone)} target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'15px 18px', background:'#DCFCE7', border:'1px solid #86EFAC', borderRadius:14, color:'#15803D', fontSize:14, fontWeight:700, textDecoration:'none' }}>
                    <MessageCircle size={16}/> WA
                  </a>
                )}
              </div>
              <button onClick={skip} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 0', background:'transparent', border:'none', color:C.label, fontSize:13, fontWeight:500, cursor:'pointer', width:'100%' }}>
                <SkipForward size={13}/> Skip this lead
              </button>
            </div>
          )}

          {/* Step 2 — timer */}
          {step === 2 && (
            <div style={{ background:'#0F172A', padding:'32px 28px', textAlign:'center' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginBottom:12 }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:'#34D399', animation:'pulse 1.5s infinite' }}/>
                <span style={{ fontSize:11, fontWeight:700, color:'#34D399', textTransform:'uppercase', letterSpacing:'0.1em' }}>Live call</span>
              </div>
              <div style={{ fontSize:52, fontWeight:900, color:'#F8FAFC', fontVariantNumeric:'tabular-nums', letterSpacing:'-0.03em', marginBottom:6 }}>{fmtTime(elapsed)}</div>
              <div style={{ fontSize:13, color:'#475569', marginBottom:24 }}>Calling {phone}</div>
              <button onClick={() => setStep(3)}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:9, padding:'13px 28px', background:'linear-gradient(135deg,#EF4444,#DC2626)', border:'none', borderRadius:14, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', margin:'0 auto', boxShadow:'0 4px 18px rgba(239,68,68,0.4)' }}>
                <PhoneOff size={16}/> Call Ended — Log It
              </button>
            </div>
          )}

          {/* Step 3 — log */}
          {step === 3 && (
            <div style={{ background:C.bg, padding:'22px 28px' }}>
              <p style={{ fontSize:12, fontWeight:700, color:C.label, textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 12px' }}>How did the call go?</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                {OUTCOMES.map(o => {
                  const Icon = o.icon
                  const sel  = outcome === o.id
                  return (
                    <button key={o.id} onClick={() => setOutcome(o.id)}
                      style={{ display:'flex', alignItems:'center', gap:9, padding:'12px 14px', borderRadius:12, border:`2px solid ${sel ? o.color : C.border}`, background: sel ? o.dim : C.panel, color: sel ? o.color : C.muted, fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.1s' }}>
                      <Icon size={15}/> {o.label}
                    </button>
                  )
                })}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Quick note (optional)…"
                style={{ width:'100%', padding:'10px 12px', border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, color:C.text, resize:'none', minHeight:54, outline:'none', boxSizing:'border-box', marginBottom:12, background:C.panel }}/>
              <button onClick={logAndNext} disabled={!outcome}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px 0', background:!outcome ? C.borderDim : (outMeta?.color ?? C.blue), border:'none', borderRadius:13, color:!outcome ? C.label : '#fff', fontSize:14, fontWeight:800, cursor:!outcome ? 'not-allowed' : 'pointer', boxShadow: outcome ? `0 4px 14px ${outMeta?.color ?? C.blue}40` : 'none' }}>
                Log &amp; Next <ChevronRight size={16}/>
              </button>
              {elapsed > 0 && <p style={{ fontSize:11, color:C.label, textAlign:'center', margin:'8px 0 0' }}>Duration: {fmtTime(elapsed)}</p>}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Today's calls */}
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:18, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Today&apos;s calls</span>
              <span style={{ fontSize:12, fontWeight:800, color:C.blue, background:C.blueDim, borderRadius:20, padding:'2px 9px' }}>{log.length}</span>
            </div>
            <div style={{ maxHeight:200, overflowY:'auto' }}>
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

          {/* Up next */}
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:18, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Up next</div>
            <div style={{ maxHeight:340, overflowY:'auto' }}>
              {leads.slice(queueIdx+1, queueIdx+9).map((lead,i) => {
                const hot  = (lead.intentScore ?? 0) >= 75
                const warm = (lead.intentScore ?? 0) >= 50
                return (
                  <div key={lead.id} style={{ padding:'10px 16px', borderBottom:`1px solid ${C.borderDim}`, display:'flex', justifyContent:'space-between', alignItems:'center', opacity: Math.max(0.35, 1-i*0.09) }}>
                    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                      <div style={{ width:30, height:30, borderRadius:9, background: hot ? 'linear-gradient(135deg,#EF4444,#DC2626)' : warm ? 'linear-gradient(135deg,#F59E0B,#D97706)' : C.blueDim, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color: (hot||warm) ? '#fff' : C.blue, flexShrink:0 }}>
                        {lead.name.firstName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{fname(lead)}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#64748B', background:'#F1F5F9', border:'1px solid #E2E8F0', padding:'1px 5px', borderRadius:4, fontFamily:'monospace' }}>{getCsId(lead)}</span>
                          <span style={{ fontSize:10, color:C.label }}>{lead.city ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                    <ScorePill score={lead.intentScore}/>
                  </div>
                )
              })}
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
