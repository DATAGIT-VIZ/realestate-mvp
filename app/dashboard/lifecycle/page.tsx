'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { type CRMLead } from '@/lib/twenty'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Loader2, Search, X } from 'lucide-react'

const BG     = '#F8FAFC'
const PANEL  = '#FFFFFF'
const BORDER = '#E2E8F0'
const TEXT   = '#0F172A'
const MUTED  = '#64748B'

type Stage  = { id: string; label: string; color: string }
type Bucket = { id: string; label: string; color: string; stages: string[]; primaryStage: string }

const STAGES: Stage[] = [
  { id: 'Fresh',           label: 'Fresh',               color: '#64748B' },
  { id: 'Attempting',      label: 'Attempting',           color: '#2563EB' },
  { id: 'VM Done',         label: 'VM Done',              color: '#7C3AED' },
  { id: 'Connected',       label: 'Connected',            color: '#0EA5E9' },
  { id: 'Virtual Meeting', label: 'Virtual Meeting Done', color: '#D97706' },
  { id: 'Site Visit',      label: 'Site Visit Done',      color: '#F97316' },
  { id: 'Negotiation',     label: 'Negotiation',          color: '#8B5CF6' },
  { id: 'Won',             label: 'Closed',               color: '#059669' },
  { id: 'Lost',            label: 'Lost',                 color: '#DC2626' },
  { id: 'NC',              label: 'NC',                   color: '#94A3B8' },
]

const STAGE_MAP: Record<string, Stage> = Object.fromEntries(STAGES.map(s => [s.id, s]))
const STAGE_IDS = new Set(STAGES.map(s => s.id))

const BUCKETS: Bucket[] = [
  { id: 'new',  label: 'New Leads',         color: '#64748B', stages: ['Fresh'],                              primaryStage: 'Fresh'      },
  { id: 'cold', label: 'Cold Stage',        color: '#2563EB', stages: ['Attempting', 'VM Done'],             primaryStage: 'Attempting' },
  { id: 'warm', label: 'Warm Stage',        color: '#D97706', stages: ['Connected', 'Virtual Meeting'],      primaryStage: 'Connected'  },
  { id: 'hot',  label: 'Hot Stage',         color: '#F97316', stages: ['Site Visit', 'Negotiation', 'Won'], primaryStage: 'Site Visit' },
  { id: 'disq', label: 'Disqualified / NC', color: '#DC2626', stages: ['Lost', 'NC'],                        primaryStage: 'Lost'       },
]

function getBucket(status: string | null | undefined): Bucket {
  const s = status ?? 'Fresh'
  return BUCKETS.find(b => b.stages.includes(s)) ?? BUCKETS[0]
}

function resolveStage(status: string | null | undefined): string {
  if (status && STAGE_IDS.has(status)) return status
  return 'Fresh'
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const P = (n: string) => ({ primaryPhoneNumber: n, primaryPhoneCountryCode: 'IN' as const })
const E = (e: string) => ({ primaryEmail: e })
const NF = { budgetMin: null, budgetMax: null, sourceDetail: null, leadPortalId: null, propertyType: null, timeline: null, localities: null, updatedAt: new Date().toISOString() }

const MOCK_LEADS: CRMLead[] = [
  { ...NF, id: 'm1',  name: { firstName: 'Rahul',   lastName: 'Mehta'  }, phones: P('+919820001111'), emails: E('rahul@x.in'),   city: 'Mumbai',    intentScore: 88, sourcePortal: 'MagicBricks', status: 'Fresh',           leadPortalId: 'CS00001', sourceDetail: '[Individual]',        createdAt: new Date(Date.now() - 1*3600000).toISOString()     },
  { ...NF, id: 'm2',  name: { firstName: 'Priya',   lastName: 'Sharma' }, phones: P('+919820002222'), emails: E('priya@x.in'),   city: 'Pune',      intentScore: 72, sourcePortal: '99acres',     status: 'Fresh',           leadPortalId: 'CS00002', sourceDetail: '[Channel Partner]',   createdAt: new Date(Date.now() - 3*3600000).toISOString()     },
  { ...NF, id: 'm3',  name: { firstName: 'Arjun',   lastName: 'Kapoor' }, phones: P('+919820003333'), emails: E('arjun@x.in'),   city: 'Bangalore', intentScore: 55, sourcePortal: 'Housing.com', status: 'Attempting',      leadPortalId: 'CS00003', sourceDetail: '[Agent]',             createdAt: new Date(Date.now() - 2*24*3600000).toISOString()  },
  { ...NF, id: 'm4',  name: { firstName: 'Sneha',   lastName: 'Nair'   }, phones: P('+919820004444'), emails: E('sneha@x.in'),   city: 'Mumbai',    intentScore: 65, sourcePortal: 'NoBroker',    status: 'Attempting',      leadPortalId: 'CS00004', sourceDetail: '[Individual]',        createdAt: new Date(Date.now() - 3*24*3600000).toISOString()  },
  { ...NF, id: 'm5',  name: { firstName: 'Vikram',  lastName: 'Singh'  }, phones: P('+919820005555'), emails: E('vikram@x.in'),  city: 'Hyderabad', intentScore: 40, sourcePortal: 'MagicBricks', status: 'VM Done',         leadPortalId: 'CS00005', sourceDetail: '[Individual]',        createdAt: new Date(Date.now() - 4*24*3600000).toISOString()  },
  { ...NF, id: 'm6',  name: { firstName: 'Anjali',  lastName: 'Desai'  }, phones: P('+919820006666'), emails: E('anjali@x.in'),  city: 'Pune',      intentScore: 78, sourcePortal: '99acres',     status: 'VM Done',         leadPortalId: 'CS00006', sourceDetail: '[Interior Designer]', createdAt: new Date(Date.now() - 60*3600000).toISOString()    },
  { ...NF, id: 'm7',  name: { firstName: 'Rohan',   lastName: 'Gupta'  }, phones: P('+919820007777'), emails: E('rohan@x.in'),   city: 'Chennai',   intentScore: 82, sourcePortal: 'Direct',      status: 'Connected',       leadPortalId: 'CS00007', sourceDetail: '[Agent]',             createdAt: new Date(Date.now() - 5*24*3600000).toISOString()  },
  { ...NF, id: 'm8',  name: { firstName: 'Kavya',   lastName: 'Reddy'  }, phones: P('+919820008888'), emails: E('kavya@x.in'),   city: 'Bangalore', intentScore: 60, sourcePortal: 'Housing.com', status: 'Connected',       leadPortalId: 'CS00008', sourceDetail: '[Individual]',        createdAt: new Date(Date.now() - 2*24*3600000).toISOString()  },
  { ...NF, id: 'm9',  name: { firstName: 'Aditya',  lastName: 'Joshi'  }, phones: P('+919820009999'), emails: E('aditya@x.in'),  city: 'Mumbai',    intentScore: 91, sourcePortal: 'MagicBricks', status: 'Virtual Meeting', leadPortalId: 'CS00009', sourceDetail: '[Channel Partner]',   createdAt: new Date(Date.now() - 6*24*3600000).toISOString()  },
  { ...NF, id: 'm10', name: { firstName: 'Divya',   lastName: 'Iyer'   }, phones: P('+919820010000'), emails: E('divya@x.in'),   city: 'Pune',      intentScore: 74, sourcePortal: '99acres',     status: 'Site Visit',      leadPortalId: 'CS00010', sourceDetail: '[Individual]',        createdAt: new Date(Date.now() - 7*24*3600000).toISOString()  },
  { ...NF, id: 'm11', name: { firstName: 'Suresh',  lastName: 'Kumar'  }, phones: P('+919820011000'), emails: E('suresh@x.in'),  city: 'Hyderabad', intentScore: 85, sourcePortal: 'Direct',      status: 'Site Visit',      leadPortalId: 'CS00011', sourceDetail: '[Agent]',             createdAt: new Date(Date.now() - 3*24*3600000).toISOString()  },
  { ...NF, id: 'm12', name: { firstName: 'Meera',   lastName: 'Pillai' }, phones: P('+919820012000'), emails: E('meera@x.in'),   city: 'Chennai',   intentScore: 93, sourcePortal: 'MagicBricks', status: 'Negotiation',     leadPortalId: 'CS00012', sourceDetail: '[Individual]',        createdAt: new Date(Date.now() - 10*24*3600000).toISOString() },
  { ...NF, id: 'm13', name: { firstName: 'Karthik', lastName: 'Balan'  }, phones: P('+919820013000'), emails: E('karthik@x.in'), city: 'Bangalore', intentScore: 95, sourcePortal: '99acres',     status: 'Won',             leadPortalId: 'CS00013', sourceDetail: '[Channel Partner]',   createdAt: new Date(Date.now() - 14*24*3600000).toISOString() },
  { ...NF, id: 'm14', name: { firstName: 'Nisha',   lastName: 'Verma'  }, phones: P('+919820014000'), emails: E('nisha@x.in'),   city: 'Mumbai',    intentScore: 30, sourcePortal: 'NoBroker',    status: 'Lost',            leadPortalId: 'CS00014', sourceDetail: '[Individual]',        createdAt: new Date(Date.now() - 8*24*3600000).toISOString()  },
  { ...NF, id: 'm15', name: { firstName: 'Prakash', lastName: 'Rao'    }, phones: P('+919820015000'), emails: E('prakash@x.in'), city: 'Pune',      intentScore: 20, sourcePortal: 'Housing.com', status: 'NC',              leadPortalId: 'CS00015', sourceDetail: '[Agent]',             createdAt: new Date(Date.now() - 12*24*3600000).toISOString() },
]

function fname(l: CRMLead) { return `${l.name.firstName} ${l.name.lastName ?? ''}`.trim() }

function timeAgo(ts: string) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

function scoreColor(s: number | null | undefined) {
  const n = s ?? 0
  if (n >= 70) return '#F97316'
  if (n >= 40) return '#D97706'
  return '#94A3B8'
}
function scoreBg(s: number | null | undefined) {
  const n = s ?? 0
  if (n >= 70) return '#FFF7ED'
  if (n >= 40) return '#FFFBEB'
  return '#F1F5F9'
}

// ─── Lead card ────────────────────────────────────────────────────────────────
function LeadCard({
  lead, bucket, currentStage, onStageChange, overlay = false, compact = false, highlighted = false,
}: {
  lead: CRMLead
  bucket: Bucket
  currentStage: Stage
  onStageChange?: (leadId: string, newStageId: string) => void
  overlay?: boolean
  compact?: boolean
  highlighted?: boolean
}) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  const isTerminal = ['Won', 'Lost', 'NC'].includes(currentStage.id)
  const sla = !isTerminal && (Date.now() - new Date(lead.createdAt).getTime()) > 48 * 3_600_000

  return (
    <div
      ref={setNodeRef}
      style={{
        background: PANEL,
        border: `1px solid ${isDragging ? bucket.color : highlighted ? bucket.color : BORDER}`,
        borderRadius: compact ? 9 : 12,
        padding: compact ? '8px 9px 7px' : '12px 12px 10px',
        cursor: overlay ? 'grabbing' : 'grab',
        position: 'relative',
        opacity: isDragging ? 0.35 : 1,
        boxShadow: overlay
          ? '0 12px 32px rgba(0,0,0,0.18)'
          : highlighted ? `0 0 0 2px ${bucket.color}50` : undefined,
        transform: overlay ? undefined : CSS.Translate.toString(transform),
        userSelect: 'none',
        touchAction: 'none',
      }}
      {...(overlay ? {} : { ...attributes, ...listeners })}
    >
      {/* SLA dot */}
      {sla && (
        <div
          title="SLA: >48h in this stage"
          style={{ position: 'absolute', top: compact ? 7 : 10, right: compact ? 7 : 10, width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }}
        />
      )}

      {/* Name + CS ID + city */}
      <div
        style={{ marginBottom: compact ? 4 : 6 }}
        onClick={overlay ? undefined : e => { e.stopPropagation(); router.push(`/dashboard/leads/${lead.id}`) }}
      >
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 700, color: TEXT, marginBottom: 1, paddingRight: sla ? 12 : 0 }}>
          {fname(lead)}
        </div>
        {!compact && lead.leadPortalId && (
          <div style={{ fontSize: 10, color: MUTED, fontFamily: 'monospace', letterSpacing: '0.02em' }}>
            {lead.leadPortalId}
          </div>
        )}
        {!compact && <div style={{ fontSize: 11, color: MUTED }}>{lead.city ?? '—'}</div>}
      </div>

      {/* Score + time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 4 : 6 }}>
        <span style={{ fontSize: compact ? 10 : 11, fontWeight: 700, color: scoreColor(lead.intentScore), background: scoreBg(lead.intentScore), padding: compact ? '1px 5px' : '2px 7px', borderRadius: 20 }}>
          {lead.intentScore ?? '—'}
        </span>
        <span style={{ fontSize: 10, color: MUTED }}>{compact ? (lead.city ?? '—') : timeAgo(lead.createdAt)}</span>
      </div>

      {/* Source portal */}
      {!compact && lead.sourcePortal && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: MUTED, background: '#F1F5F9', padding: '2px 6px', borderRadius: 6 }}>
            {lead.sourcePortal}
          </span>
        </div>
      )}

      {/* Sub-stage selector — pill buttons for each stage in this bucket */}
      {!overlay && !compact && bucket.stages.length > 1 && onStageChange && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BORDER}` }}>
          {bucket.stages.map(sid => {
            const s = STAGE_MAP[sid]
            if (!s) return null
            const active = currentStage.id === sid
            return (
              <button
                key={sid}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); if (!active) onStageChange(lead.id, sid) }}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 20,
                  border: `1px solid ${active ? s.color : BORDER}`,
                  background: active ? `${s.color}18` : 'transparent',
                  color: active ? s.color : MUTED,
                  cursor: active ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Bucket column ────────────────────────────────────────────────────────────
function BucketColumn({
  bucket, leads, onStageChange, activeId, csSearch, onCsSearch,
  isSearchOpen, onOpenSearch, onCloseSearch, highlightId, compact = false,
}: {
  bucket: Bucket
  leads: CRMLead[]
  onStageChange: (leadId: string, newStageId: string) => void
  activeId: string | null
  csSearch?: string
  onCsSearch?: (v: string) => void
  isSearchOpen?: boolean
  onOpenSearch?: () => void
  onCloseSearch?: () => void
  highlightId?: string | null
  compact?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.id })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSearchOpen) inputRef.current?.focus()
  }, [isSearchOpen])

  return (
    <div style={{ width: compact ? '100%' : 250, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: compact ? '7px 10px' : '10px 14px',
        background: PANEL,
        border: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${bucket.color}`,
        borderRadius: '10px 10px 0 0',
      }}>
        {isSearchOpen ? (
          <>
            <Search style={{ width: 11, height: 11, color: bucket.color, flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={csSearch ?? ''}
              onChange={e => onCsSearch?.(e.target.value.toUpperCase())}
              placeholder="CS00001"
              style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', border: 'none', outline: 'none', background: 'transparent', color: TEXT, minWidth: 0 }}
            />
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => { onCsSearch?.(''); onCloseSearch?.() }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: MUTED, display: 'flex', flexShrink: 0 }}
            >
              <X style={{ width: 12, height: 12 }} />
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: bucket.color, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {bucket.label}
            </span>
            {!compact && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={onOpenSearch}
                title="Search by CS ID"
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 3px', color: MUTED, display: 'flex', borderRadius: 4, flexShrink: 0 }}
              >
                <Search style={{ width: 12, height: 12 }} />
              </button>
            )}
          </>
        )}
        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: bucket.color, borderRadius: 20, padding: '1px 7px', flexShrink: 0 }}>
          {leads.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        style={{
          background: isOver ? `${bucket.color}12` : `${bucket.color}06`,
          border: `1px solid ${isOver ? bucket.color : BORDER}`,
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          padding: compact ? 6 : 8,
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 5 : 8,
          minHeight: compact ? 80 : 200,
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {leads.length === 0 && !isOver ? (
          <div style={{ textAlign: 'center', padding: compact ? '12px 4px' : '24px 8px', color: MUTED, fontSize: compact ? 11 : 12, pointerEvents: 'none' }}>
            {activeId ? 'Drop here' : '—'}
          </div>
        ) : (
          leads.map(lead => {
            const stage = STAGE_MAP[resolveStage(lead.status)] ?? STAGES[0]
            return (
              <LeadCard
                key={lead.id}
                lead={lead}
                bucket={bucket}
                currentStage={stage}
                onStageChange={onStageChange}
                compact={compact}
                highlighted={lead.id === highlightId}
              />
            )
          })
        )}
        {isOver && <div style={{ height: 3, borderRadius: 2, background: bucket.color, opacity: 0.4 }} />}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LifecyclePage() {
  const [leads,    setLeads]    = useState<CRMLead[]>([])
  const [loading,  setLoading]  = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [csSearch,       setCsSearch]       = useState('')
  const [searchBucketId, setSearchBucketId] = useState<string | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true)
      const res  = await fetch('/api/crm/leads?cursor=&limit=200')
      const json = await res.json()
      const data = (json.data?.leads ?? []) as CRMLead[]
      setLeads(data.length > 0 ? data : MOCK_LEADS)
    } catch {
      setLeads(MOCK_LEADS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const handleStageChange = async (leadId: string, newStageId: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStageId } : l))
    try {
      await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStageId }),
      })
    } catch { /* optimistic */ }
  }

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string)

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over) return
    const targetBucket = BUCKETS.find(b => b.id === over.id)
    if (!targetBucket) return
    const currentBucket = getBucket(resolveStage(leads.find(l => l.id === active.id)?.status))
    if (currentBucket.id === targetBucket.id) return
    handleStageChange(active.id as string, targetBucket.primaryStage)
  }

  // CS ID search — filters all columns
  const searchNorm = csSearch.trim()
  const filteredLeads = searchNorm
    ? leads.filter(l => (l.leadPortalId ?? '').toUpperCase().includes(searchNorm.toUpperCase()))
    : leads
  const highlightId = searchNorm && filteredLeads.length === 1 ? filteredLeads[0].id : null

  const grouped = BUCKETS.reduce<Record<string, CRMLead[]>>((acc, b) => {
    acc[b.id] = filteredLeads.filter(l => getBucket(resolveStage(l.status)).id === b.id)
    return acc
  }, {})

  const activeLead  = activeId ? leads.find(l => l.id === activeId) : null
  const activeBucket = activeLead ? getBucket(resolveStage(activeLead.status)) : BUCKETS[0]
  const activeStage  = activeLead ? (STAGE_MAP[resolveStage(activeLead.status)] ?? STAGES[0]) : STAGES[0]

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Loader2 style={{ width: 20, height: 20, color: '#2563EB', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14, color: MUTED }}>Loading lifecycle…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ minHeight: '100vh', background: BG }}>

        {/* Page header */}
        <div className="px-4 lg:px-7 py-4 lg:py-5 flex items-start justify-between gap-3 flex-wrap" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <h1 className="hidden lg:block" style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 4px' }}>Lead Lifecycle</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              {leads.length} leads · drag to move between stages
              {searchNorm && <span style={{ marginLeft: 8, color: '#2563EB', fontWeight: 600 }}>· filtering by CS ID: {searchNorm}</span>}
            </p>
          </div>
          {/* Bucket legend */}
          <div className="hidden lg:flex gap-[10px] flex-wrap justify-end">
            {BUCKETS.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: b.color }} />
                <span style={{ fontSize: 10, color: MUTED }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Board */}
        {isMobile ? (
          <div style={{ padding: '12px 12px 100px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {BUCKETS.map(bucket => (
              <BucketColumn
                key={bucket.id}
                bucket={bucket}
                leads={grouped[bucket.id] ?? []}
                onStageChange={handleStageChange}
                activeId={activeId}
                highlightId={highlightId}
                compact
              />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: 60 }}>
            <div style={{ display: 'flex', gap: 12, padding: '20px 28px 0', width: 'max-content' }}>
              {BUCKETS.map(bucket => (
                <BucketColumn
                  key={bucket.id}
                  bucket={bucket}
                  leads={grouped[bucket.id] ?? []}
                  onStageChange={handleStageChange}
                  activeId={activeId}
                  csSearch={csSearch}
                  onCsSearch={setCsSearch}
                  isSearchOpen={searchBucketId === bucket.id}
                  onOpenSearch={() => setSearchBucketId(bucket.id)}
                  onCloseSearch={() => { setSearchBucketId(null); setCsSearch('') }}
                  highlightId={highlightId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <LeadCard lead={activeLead} bucket={activeBucket} currentStage={activeStage} overlay />
          ) : null}
        </DragOverlay>

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </DndContext>
  )
}
