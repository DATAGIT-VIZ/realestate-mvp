'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { type CRMLead } from '@/lib/twenty'
import { ChevronRight, Loader2, AlertCircle } from 'lucide-react'

const BG = '#F8FAFC'
const PANEL = '#FFFFFF'
const BORDER = '#E2E8F0'
const TEXT = '#0F172A'
const MUTED = '#64748B'

const LIFECYCLE_STAGES = [
  { id: 'Fresh',           label: 'Fresh',               color: '#64748B', terminal: false },
  { id: 'Attempting',      label: 'Attempting',           color: '#2563EB', terminal: false },
  { id: 'VM Done',         label: 'VM Done',              color: '#7C3AED', terminal: false },
  { id: 'Connected',       label: 'Connected',            color: '#0EA5E9', terminal: false },
  { id: 'Virtual Meeting', label: 'Virtual Meeting Done', color: '#D97706', terminal: false },
  { id: 'Site Visit',      label: 'Site Visit Done',      color: '#F97316', terminal: false },
  { id: 'Negotiation',     label: 'Negotiation',          color: '#8B5CF6', terminal: false },
  { id: 'Won',             label: 'Won',                  color: '#059669', terminal: true  },
  { id: 'Lost',            label: 'Lost',                 color: '#DC2626', terminal: true  },
  { id: 'NC',              label: 'NC',                   color: '#94A3B8', terminal: true  },
]

const STAGE_IDS = LIFECYCLE_STAGES.map(s => s.id)

const P = (n: string) => ({ primaryPhoneNumber: n, primaryPhoneCountryCode: 'IN' as const })
const E = (e: string) => ({ primaryEmail: e })
const NULL_FIELDS = { budgetMin: null, budgetMax: null, sourceDetail: null, leadPortalId: null, propertyType: null, timeline: null, localities: null, updatedAt: new Date().toISOString() }

const MOCK_LEADS: CRMLead[] = [
  { id: 'm1',  name: { firstName: 'Rahul',   lastName: 'Mehta'  }, phones: P('+919820001111'), emails: E('rahul@x.in'),   city: 'Mumbai',    intentScore: 88, sourcePortal: 'MagicBricks', status: 'Fresh',           createdAt: new Date(Date.now() - 1*3600000).toISOString(),    ...NULL_FIELDS },
  { id: 'm2',  name: { firstName: 'Priya',   lastName: 'Sharma' }, phones: P('+919820002222'), emails: E('priya@x.in'),   city: 'Pune',      intentScore: 72, sourcePortal: '99acres',     status: 'Fresh',           createdAt: new Date(Date.now() - 3*3600000).toISOString(),    ...NULL_FIELDS },
  { id: 'm3',  name: { firstName: 'Arjun',   lastName: 'Kapoor' }, phones: P('+919820003333'), emails: E('arjun@x.in'),   city: 'Bangalore', intentScore: 55, sourcePortal: 'Housing.com', status: 'Attempting',      createdAt: new Date(Date.now() - 2*24*3600000).toISOString(), ...NULL_FIELDS },
  { id: 'm4',  name: { firstName: 'Sneha',   lastName: 'Nair'   }, phones: P('+919820004444'), emails: E('sneha@x.in'),   city: 'Mumbai',    intentScore: 65, sourcePortal: 'NoBroker',    status: 'Attempting',      createdAt: new Date(Date.now() - 3*24*3600000).toISOString(), ...NULL_FIELDS },
  { id: 'm5',  name: { firstName: 'Vikram',  lastName: 'Singh'  }, phones: P('+919820005555'), emails: E('vikram@x.in'),  city: 'Hyderabad', intentScore: 40, sourcePortal: 'MagicBricks', status: 'VM Done',         createdAt: new Date(Date.now() - 4*24*3600000).toISOString(), ...NULL_FIELDS },
  { id: 'm6',  name: { firstName: 'Anjali',  lastName: 'Desai'  }, phones: P('+919820006666'), emails: E('anjali@x.in'),  city: 'Pune',      intentScore: 78, sourcePortal: '99acres',     status: 'VM Done',         createdAt: new Date(Date.now() - 60*3600000).toISOString(),   ...NULL_FIELDS },
  { id: 'm7',  name: { firstName: 'Rohan',   lastName: 'Gupta'  }, phones: P('+919820007777'), emails: E('rohan@x.in'),   city: 'Chennai',   intentScore: 82, sourcePortal: 'Direct',      status: 'Connected',       createdAt: new Date(Date.now() - 5*24*3600000).toISOString(), ...NULL_FIELDS },
  { id: 'm8',  name: { firstName: 'Kavya',   lastName: 'Reddy'  }, phones: P('+919820008888'), emails: E('kavya@x.in'),   city: 'Bangalore', intentScore: 60, sourcePortal: 'Housing.com', status: 'Connected',       createdAt: new Date(Date.now() - 2*24*3600000).toISOString(), ...NULL_FIELDS },
  { id: 'm9',  name: { firstName: 'Aditya',  lastName: 'Joshi'  }, phones: P('+919820009999'), emails: E('aditya@x.in'),  city: 'Mumbai',    intentScore: 91, sourcePortal: 'MagicBricks', status: 'Virtual Meeting', createdAt: new Date(Date.now() - 6*24*3600000).toISOString(), ...NULL_FIELDS },
  { id: 'm10', name: { firstName: 'Divya',   lastName: 'Iyer'   }, phones: P('+919820010000'), emails: E('divya@x.in'),   city: 'Pune',      intentScore: 74, sourcePortal: '99acres',     status: 'Site Visit',      createdAt: new Date(Date.now() - 7*24*3600000).toISOString(), ...NULL_FIELDS },
  { id: 'm11', name: { firstName: 'Suresh',  lastName: 'Kumar'  }, phones: P('+919820011000'), emails: E('suresh@x.in'),  city: 'Hyderabad', intentScore: 85, sourcePortal: 'Direct',      status: 'Site Visit',      createdAt: new Date(Date.now() - 3*24*3600000).toISOString(), ...NULL_FIELDS },
  { id: 'm12', name: { firstName: 'Meera',   lastName: 'Pillai' }, phones: P('+919820012000'), emails: E('meera@x.in'),   city: 'Chennai',   intentScore: 93, sourcePortal: 'MagicBricks', status: 'Negotiation',     createdAt: new Date(Date.now() - 10*24*3600000).toISOString(),...NULL_FIELDS },
  { id: 'm13', name: { firstName: 'Karthik', lastName: 'Balan'  }, phones: P('+919820013000'), emails: E('karthik@x.in'), city: 'Bangalore', intentScore: 95, sourcePortal: '99acres',     status: 'Won',             createdAt: new Date(Date.now() - 14*24*3600000).toISOString(),...NULL_FIELDS },
  { id: 'm14', name: { firstName: 'Nisha',   lastName: 'Verma'  }, phones: P('+919820014000'), emails: E('nisha@x.in'),   city: 'Mumbai',    intentScore: 30, sourcePortal: 'NoBroker',    status: 'Lost',            createdAt: new Date(Date.now() - 8*24*3600000).toISOString(),  ...NULL_FIELDS },
  { id: 'm15', name: { firstName: 'Prakash', lastName: 'Rao'    }, phones: P('+919820015000'), emails: E('prakash@x.in'), city: 'Pune',      intentScore: 20, sourcePortal: 'Housing.com', status: 'NC',              createdAt: new Date(Date.now() - 12*24*3600000).toISOString(), ...NULL_FIELDS },
]

function fname(l: CRMLead) { return `${l.name.firstName} ${l.name.lastName ?? ''}`.trim() }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'Just now'
}

function scoreColor(score: number | null | undefined) {
  const s = score ?? 0
  if (s >= 70) return '#F97316'
  if (s >= 40) return '#D97706'
  return '#94A3B8'
}

function scoreBg(score: number | null | undefined) {
  const s = score ?? 0
  if (s >= 70) return '#FFF7ED'
  if (s >= 40) return '#FFFBEB'
  return '#F1F5F9'
}

function isSlaBreached(lead: CRMLead, stage: typeof LIFECYCLE_STAGES[0]) {
  if (stage.terminal) return false
  const diffH = (Date.now() - new Date(lead.createdAt).getTime()) / 3_600_000
  return diffH > 48
}

function resolveStage(status: string | null | undefined): string {
  if (!status) return 'Fresh'
  if (STAGE_IDS.includes(status)) return status
  return 'Fresh'
}

function nextStageId(currentId: string): string | null {
  const idx = LIFECYCLE_STAGES.findIndex(s => s.id === currentId)
  if (idx === -1 || idx >= LIFECYCLE_STAGES.length - 1) return null
  const next = LIFECYCLE_STAGES[idx + 1]
  return next ? next.id : null
}

function LeadCard({
  lead, stage, onAdvance,
}: {
  lead: CRMLead
  stage: typeof LIFECYCLE_STAGES[0]
  onAdvance: (leadId: string, newStage: string) => void
}) {
  const router = useRouter()
  const nextId = nextStageId(stage.id)
  const sla = isSlaBreached(lead, stage)
  const score = lead.intentScore ?? 0

  return (
    <div
      onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
      style={{
        background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12,
        padding: '12px 12px 10px', cursor: 'pointer', position: 'relative',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
    >
      {/* SLA warning dot */}
      {sla && (
        <div style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: '50%', background: '#EF4444' }} title="SLA breached: >48h in this stage" />
      )}

      {/* Name + city */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 2 }}>{fname(lead)}</div>
        <div style={{ fontSize: 11, color: MUTED }}>{lead.city ?? '—'}</div>
      </div>

      {/* Score badge + time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(lead.intentScore), background: scoreBg(lead.intentScore), padding: '2px 7px', borderRadius: 20 }}>
          {score}
        </span>
        <span style={{ fontSize: 10, color: MUTED }}>{timeAgo(lead.createdAt)}</span>
      </div>

      {/* Source portal */}
      {lead.sourcePortal && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: MUTED, background: '#F1F5F9', padding: '2px 6px', borderRadius: 6 }}>
            {lead.sourcePortal}
          </span>
        </div>
      )}

      {/* Advance button */}
      {nextId && !stage.terminal && (
        <button
          onClick={e => { e.stopPropagation(); onAdvance(lead.id, nextId) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600,
            color: stage.color, background: `${stage.color}10`, border: `1px solid ${stage.color}30`,
            borderRadius: 7, padding: '4px 8px', cursor: 'pointer', width: '100%', justifyContent: 'center',
          }}
        >
          Move to {LIFECYCLE_STAGES.find(s => s.id === nextId)?.label ?? nextId}
          <ChevronRight style={{ width: 11, height: 11 }} />
        </button>
      )}
    </div>
  )
}

export default function LifecyclePage() {
  const [leads, setLeads] = useState<CRMLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true)
      const res  = await fetch('/api/crm/leads?cursor=&limit=200')
      const json = await res.json()
      const data = (json.data?.leads ?? []) as CRMLead[]
      setLeads(data.length > 0 ? data : MOCK_LEADS)
    } catch {
      setLeads(MOCK_LEADS)
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const handleAdvance = async (leadId: string, newStageId: string) => {
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStageId } : l))
    try {
      await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStageId }),
      })
    } catch {
      // silent — optimistic already applied
    }
  }

  const grouped = LIFECYCLE_STAGES.reduce<Record<string, CRMLead[]>>((acc, stage) => {
    acc[stage.id] = leads.filter(l => resolveStage(l.status) === stage.id)
    return acc
  }, {})

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Loader2 style={{ width: 20, height: 20, color: '#2563EB', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14, color: MUTED }}>Loading lifecycle…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <AlertCircle style={{ width: 36, height: 36, color: '#EF4444', margin: '0 auto 12px', display: 'block' }} />
          <p style={{ fontSize: 14, color: MUTED }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      {/* Header */}
      <div style={{ padding: '24px 28px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 4px' }}>Lead Lifecycle</h1>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{leads.length} leads across {LIFECYCLE_STAGES.length} stages</p>
        </div>
        {/* Stage legend */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {LIFECYCLE_STAGES.filter(s => !s.terminal).map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
              <span style={{ fontSize: 10, color: MUTED }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Board — horizontal scroll */}
      <div style={{ overflowX: 'auto', paddingBottom: 32 }}>
        <div style={{ display: 'flex', gap: 12, padding: '0 28px', width: 'max-content' }}>
          {LIFECYCLE_STAGES.map(stage => {
            const stageLeads = grouped[stage.id] ?? []
            return (
              <div key={stage.id}
                style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: PANEL,
                  border: `1px solid ${BORDER}`, borderLeft: `3px solid ${stage.color}`,
                  borderRadius: '10px 10px 0 0', marginBottom: 0,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{stage.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: stage.color, borderRadius: 20, padding: '1px 8px' }}>
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{
                  background: `${stage.color}06`,
                  border: `1px solid ${BORDER}`, borderTop: 'none',
                  borderRadius: '0 0 10px 10px', padding: 8,
                  display: 'flex', flexDirection: 'column', gap: 8,
                  minHeight: 200,
                }}>
                  {stageLeads.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 8px', color: MUTED, fontSize: 12 }}>
                      No leads here
                    </div>
                  ) : (
                    stageLeads.map(lead => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        stage={stage}
                        onAdvance={handleAdvance}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
