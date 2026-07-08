'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { type CRMLead } from '@/lib/twenty'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, Loader2 } from 'lucide-react'

const BG     = '#F8FAFC'
const PANEL  = '#FFFFFF'
const BORDER = '#E2E8F0'
const TEXT   = '#0F172A'
const MUTED  = '#64748B'

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
const NF = { budgetMin: null, budgetMax: null, sourceDetail: null, leadPortalId: null, propertyType: null, timeline: null, localities: null, updatedAt: new Date().toISOString() }

const MOCK_LEADS: CRMLead[] = [
  { ...NF, id: 'm1',  name: { firstName: 'Rahul',   lastName: 'Mehta'  }, phones: P('+919820001111'), emails: E('rahul@x.in'),   city: 'Mumbai',    intentScore: 88, sourcePortal: 'MagicBricks', status: 'Fresh',           createdAt: new Date(Date.now() - 1*3600000).toISOString()     },
  { ...NF, id: 'm2',  name: { firstName: 'Priya',   lastName: 'Sharma' }, phones: P('+919820002222'), emails: E('priya@x.in'),   city: 'Pune',      intentScore: 72, sourcePortal: '99acres',     status: 'Fresh',           createdAt: new Date(Date.now() - 3*3600000).toISOString()     },
  { ...NF, id: 'm3',  name: { firstName: 'Arjun',   lastName: 'Kapoor' }, phones: P('+919820003333'), emails: E('arjun@x.in'),   city: 'Bangalore', intentScore: 55, sourcePortal: 'Housing.com', status: 'Attempting',      createdAt: new Date(Date.now() - 2*24*3600000).toISOString()  },
  { ...NF, id: 'm4',  name: { firstName: 'Sneha',   lastName: 'Nair'   }, phones: P('+919820004444'), emails: E('sneha@x.in'),   city: 'Mumbai',    intentScore: 65, sourcePortal: 'NoBroker',    status: 'Attempting',      createdAt: new Date(Date.now() - 3*24*3600000).toISOString()  },
  { ...NF, id: 'm5',  name: { firstName: 'Vikram',  lastName: 'Singh'  }, phones: P('+919820005555'), emails: E('vikram@x.in'),  city: 'Hyderabad', intentScore: 40, sourcePortal: 'MagicBricks', status: 'VM Done',         createdAt: new Date(Date.now() - 4*24*3600000).toISOString()  },
  { ...NF, id: 'm6',  name: { firstName: 'Anjali',  lastName: 'Desai'  }, phones: P('+919820006666'), emails: E('anjali@x.in'),  city: 'Pune',      intentScore: 78, sourcePortal: '99acres',     status: 'VM Done',         createdAt: new Date(Date.now() - 60*3600000).toISOString()    },
  { ...NF, id: 'm7',  name: { firstName: 'Rohan',   lastName: 'Gupta'  }, phones: P('+919820007777'), emails: E('rohan@x.in'),   city: 'Chennai',   intentScore: 82, sourcePortal: 'Direct',      status: 'Connected',       createdAt: new Date(Date.now() - 5*24*3600000).toISOString()  },
  { ...NF, id: 'm8',  name: { firstName: 'Kavya',   lastName: 'Reddy'  }, phones: P('+919820008888'), emails: E('kavya@x.in'),   city: 'Bangalore', intentScore: 60, sourcePortal: 'Housing.com', status: 'Connected',       createdAt: new Date(Date.now() - 2*24*3600000).toISOString()  },
  { ...NF, id: 'm9',  name: { firstName: 'Aditya',  lastName: 'Joshi'  }, phones: P('+919820009999'), emails: E('aditya@x.in'),  city: 'Mumbai',    intentScore: 91, sourcePortal: 'MagicBricks', status: 'Virtual Meeting', createdAt: new Date(Date.now() - 6*24*3600000).toISOString()  },
  { ...NF, id: 'm10', name: { firstName: 'Divya',   lastName: 'Iyer'   }, phones: P('+919820010000'), emails: E('divya@x.in'),   city: 'Pune',      intentScore: 74, sourcePortal: '99acres',     status: 'Site Visit',      createdAt: new Date(Date.now() - 7*24*3600000).toISOString()  },
  { ...NF, id: 'm11', name: { firstName: 'Suresh',  lastName: 'Kumar'  }, phones: P('+919820011000'), emails: E('suresh@x.in'),  city: 'Hyderabad', intentScore: 85, sourcePortal: 'Direct',      status: 'Site Visit',      createdAt: new Date(Date.now() - 3*24*3600000).toISOString()  },
  { ...NF, id: 'm12', name: { firstName: 'Meera',   lastName: 'Pillai' }, phones: P('+919820012000'), emails: E('meera@x.in'),   city: 'Chennai',   intentScore: 93, sourcePortal: 'MagicBricks', status: 'Negotiation',     createdAt: new Date(Date.now() - 10*24*3600000).toISOString() },
  { ...NF, id: 'm13', name: { firstName: 'Karthik', lastName: 'Balan'  }, phones: P('+919820013000'), emails: E('karthik@x.in'), city: 'Bangalore', intentScore: 95, sourcePortal: '99acres',     status: 'Won',             createdAt: new Date(Date.now() - 14*24*3600000).toISOString() },
  { ...NF, id: 'm14', name: { firstName: 'Nisha',   lastName: 'Verma'  }, phones: P('+919820014000'), emails: E('nisha@x.in'),   city: 'Mumbai',    intentScore: 30, sourcePortal: 'NoBroker',    status: 'Lost',            createdAt: new Date(Date.now() - 8*24*3600000).toISOString()  },
  { ...NF, id: 'm15', name: { firstName: 'Prakash', lastName: 'Rao'    }, phones: P('+919820015000'), emails: E('prakash@x.in'), city: 'Pune',      intentScore: 20, sourcePortal: 'Housing.com', status: 'NC',              createdAt: new Date(Date.now() - 12*24*3600000).toISOString() },
]

function fname(l: CRMLead) { return `${l.name.firstName} ${l.name.lastName ?? ''}`.trim() }

function timeAgo(ts: string) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000
  if (d < 3600)  return `${Math.floor(d/60)}m ago`
  if (d < 86400) return `${Math.floor(d/3600)}h ago`
  return `${Math.floor(d/86400)}d ago`
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

function resolveStage(status: string | null | undefined): string {
  if (status && STAGE_IDS.includes(status)) return status
  return 'Fresh'
}

function nextStageId(id: string): string | null {
  const idx = LIFECYCLE_STAGES.findIndex(s => s.id === id)
  if (idx < 0 || idx >= LIFECYCLE_STAGES.length - 1) return null
  return LIFECYCLE_STAGES[idx + 1]?.id ?? null
}

// ─── Draggable lead card ──────────────────────────────────────────────────────
function LeadCard({
  lead, stage, onAdvance, overlay = false,
}: {
  lead: CRMLead
  stage: typeof LIFECYCLE_STAGES[0]
  onAdvance?: (leadId: string, newStage: string) => void
  overlay?: boolean
}) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  const nextId = nextStageId(stage.id)
  const sla = !stage.terminal && (Date.now() - new Date(lead.createdAt).getTime()) > 48 * 3_600_000

  const style: React.CSSProperties = {
    background: PANEL,
    border: `1px solid ${isDragging ? stage.color : BORDER}`,
    borderRadius: 12,
    padding: '12px 12px 10px',
    cursor: overlay ? 'grabbing' : 'grab',
    position: 'relative',
    opacity: isDragging ? 0.35 : 1,
    boxShadow: overlay ? '0 12px 32px rgba(0,0,0,0.18)' : undefined,
    transform: overlay ? undefined : CSS.Translate.toString(transform),
    userSelect: 'none',
    touchAction: 'none',
  }

  return (
    <div ref={setNodeRef} style={style} {...(overlay ? {} : { ...attributes, ...listeners })}>
      {sla && (
        <div title="SLA: >48h in this stage" style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: '50%', background: '#EF4444' }} />
      )}

      {/* Name + city — click to navigate (only when not overlay) */}
      <div
        style={{ marginBottom: 8 }}
        onClick={overlay ? undefined : (e) => { e.stopPropagation(); router.push(`/dashboard/leads/${lead.id}`) }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 2 }}>{fname(lead)}</div>
        <div style={{ fontSize: 11, color: MUTED }}>{lead.city ?? '—'}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(lead.intentScore), background: scoreBg(lead.intentScore), padding: '2px 7px', borderRadius: 20 }}>
          {lead.intentScore ?? '—'}
        </span>
        <span style={{ fontSize: 10, color: MUTED }}>{timeAgo(lead.createdAt)}</span>
      </div>

      {lead.sourcePortal && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: MUTED, background: '#F1F5F9', padding: '2px 6px', borderRadius: 6 }}>{lead.sourcePortal}</span>
        </div>
      )}

      {!overlay && nextId && !stage.terminal && onAdvance && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onAdvance(lead.id, nextId) }}
          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: stage.color, background: `${stage.color}10`, border: `1px solid ${stage.color}30`, borderRadius: 7, padding: '4px 8px', cursor: 'pointer', width: '100%', justifyContent: 'center' }}
        >
          {LIFECYCLE_STAGES.find(s => s.id === nextId)?.label ?? nextId}
          <ChevronRight style={{ width: 11, height: 11 }} />
        </button>
      )}
    </div>
  )
}

// ─── Droppable column ─────────────────────────────────────────────────────────
function StageColumn({
  stage, leads, onAdvance, activeId,
}: {
  stage: typeof LIFECYCLE_STAGES[0]
  leads: CRMLead[]
  onAdvance: (leadId: string, newStage: string) => void
  activeId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: PANEL, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${stage.color}`, borderRadius: '10px 10px 0 0' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{stage.label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: stage.color, borderRadius: 20, padding: '1px 8px' }}>{leads.length}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        style={{
          background: isOver ? `${stage.color}12` : `${stage.color}06`,
          border: `1px solid ${isOver ? stage.color : BORDER}`,
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 200,
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {leads.length === 0 && !isOver ? (
          <div style={{ textAlign: 'center', padding: '24px 8px', color: MUTED, fontSize: 12, pointerEvents: 'none' }}>
            {activeId ? 'Drop here' : 'No leads'}
          </div>
        ) : (
          leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} stage={stage} onAdvance={onAdvance} />
          ))
        )}
        {isOver && (
          <div style={{ height: 4, borderRadius: 2, background: stage.color, opacity: 0.4 }} />
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LifecyclePage() {
  const [leads,    setLeads]    = useState<CRMLead[]>([])
  const [loading,  setLoading]  = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

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

  const handleAdvance = async (leadId: string, newStageId: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStageId } : l))
    try {
      await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStageId }),
      })
    } catch { /* optimistic — ignore */ }
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const newStage = over.id as string
    if (!STAGE_IDS.includes(newStage)) return
    handleAdvance(active.id as string, newStage)
  }

  const grouped = LIFECYCLE_STAGES.reduce<Record<string, CRMLead[]>>((acc, s) => {
    acc[s.id] = leads.filter(l => resolveStage(l.status) === s.id)
    return acc
  }, {})

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null
  const activeLeadStage = activeLead ? LIFECYCLE_STAGES.find(s => s.id === resolveStage(activeLead.status)) ?? LIFECYCLE_STAGES[0] : LIFECYCLE_STAGES[0]

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

        {/* Header */}
        <div style={{ padding: '24px 28px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 4px' }}>Lead Lifecycle</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{leads.length} leads · drag cards to move between stages</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {LIFECYCLE_STAGES.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                <span style={{ fontSize: 10, color: MUTED }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Board */}
        <div style={{ overflowX: 'auto', paddingBottom: 40 }}>
          <div style={{ display: 'flex', gap: 12, padding: '20px 28px', width: 'max-content' }}>
            {LIFECYCLE_STAGES.map(stage => (
              <StageColumn
                key={stage.id}
                stage={stage}
                leads={grouped[stage.id] ?? []}
                onAdvance={handleAdvance}
                activeId={activeId}
              />
            ))}
          </div>
        </div>

        {/* Drag overlay — floating card that follows cursor */}
        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <LeadCard lead={activeLead} stage={activeLeadStage} overlay />
          ) : null}
        </DragOverlay>

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </DndContext>
  )
}
