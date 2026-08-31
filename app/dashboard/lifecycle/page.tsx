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
import {
  Phone, Warning, Clock, MagnifyingGlass, X, CircleNotch,
  WhatsappLogo, Funnel, CaretRight, CaretDown, ArrowCircleRight, UserSwitch,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'
import { AIDealCoach } from '@/components/AIDealCoach'
import { ReassignModal } from '@/components/ReassignModal'

const LEADS_TABS = [
  { label: 'All Leads', href: '/dashboard/leads' },
  { label: 'Pipeline',  href: '/dashboard/lifecycle' },
]

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BG        = '#FAFAF8'
const PANEL     = '#FFFFFF'
const BORDER    = '#E2E2DC'
const TEXT      = '#0C0C0B'
const MUTED     = '#78889B'
const LABEL     = '#A4B1BE'
const BLUE      = '#1D4ED8'
const BLUE_DIM  = 'rgba(29,78,216,0.07)'
const EMERALD   = '#059669'
const AMBER     = '#F59E0B'
const RED       = '#EF4444'

// ─── Types ─────────────────────────────────────────────────────────────────────
type Stage  = { id: string; label: string; color: string }
type Bucket = { id: string; label: string; color: string; lightBg: string; stages: string[]; primaryStage: string }

const STAGES: Stage[] = [
  { id: 'Fresh',           label: 'Fresh',               color: MUTED     },
  { id: 'Attempting',      label: 'Attempting',           color: '#3B82F6' },
  { id: 'VM Done',         label: 'VM Done',              color: '#3B82F6' },
  { id: 'Connected',       label: 'Connected',            color: AMBER     },
  { id: 'Virtual Meeting', label: 'Virtual Meeting Done', color: AMBER     },
  { id: 'Site Visit',      label: 'Site Visit Done',      color: BLUE      },
  { id: 'Negotiation',     label: 'Negotiation',          color: BLUE      },
  { id: 'Won',             label: 'Closed Won',           color: EMERALD   },
  { id: 'Lost',            label: 'Lost',                 color: RED       },
  { id: 'NC',              label: 'NC',                   color: LABEL     },
]

// Linear stage progression for "→ Next Stage" quick action
const STAGE_SEQUENCE = ['Fresh', 'Attempting', 'VM Done', 'Connected', 'Virtual Meeting', 'Site Visit', 'Negotiation', 'Won']

const STAGE_MAP: Record<string, Stage> = Object.fromEntries(STAGES.map(s => [s.id, s]))
const STAGE_IDS = new Set(STAGES.map(s => s.id))

const BUCKETS: Bucket[] = [
  { id: 'new',  label: 'New',          color: MUTED,     lightBg: 'rgba(120,136,155,0.04)', stages: ['Fresh'],                              primaryStage: 'Fresh'      },
  { id: 'cold', label: 'Cold',         color: '#3B82F6', lightBg: 'rgba(59,130,246,0.04)',  stages: ['Attempting', 'VM Done'],             primaryStage: 'Attempting' },
  { id: 'warm', label: 'Warm',         color: AMBER,     lightBg: 'rgba(245,158,11,0.04)',  stages: ['Connected', 'Virtual Meeting'],      primaryStage: 'Connected'  },
  { id: 'hot',  label: 'Hot',          color: BLUE,      lightBg: BLUE_DIM,                 stages: ['Site Visit', 'Negotiation', 'Won'],  primaryStage: 'Site Visit' },
  { id: 'disq', label: 'Disqualified', color: RED,       lightBg: 'rgba(239,68,68,0.04)',   stages: ['Lost', 'NC'],                        primaryStage: 'Lost'       },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getBucket(status: string | null | undefined): Bucket {
  const s = status ?? 'Fresh'
  return BUCKETS.find(b => b.stages.includes(s)) ?? BUCKETS[0]
}

function resolveStage(status: string | null | undefined): string {
  if (status && STAGE_IDS.has(status)) return status
  return 'Fresh'
}

function fname(l: CRMLead) { return `${l.name.firstName} ${l.name.lastName ?? ''}`.trim() }

function getInitials(l: CRMLead) {
  const f = l.name.firstName?.[0] ?? ''
  const la = l.name.lastName?.[0] ?? ''
  return (f + la).toUpperCase() || '?'
}

const AVATAR_PALETTE = [
  { bg: '#FFF0EB', fg: BLUE      },
  { bg: '#FFF8E7', fg: AMBER     },
  { bg: '#ECFDF5', fg: EMERALD   },
  { bg: '#EFF6FF', fg: '#3B82F6' },
  { bg: '#F5F3FF', fg: '#8B5CF6' },
  { bg: '#FFF1F2', fg: RED       },
]
function avatarColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[h]
}

function formatBudget(min: number | null, max: number | null): string {
  const v = max ?? min ?? 0
  if (!v) return ''
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)} Cr`
  if (v >= 1_00_000)    return `₹${(v / 1_00_000).toFixed(0)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

function formatPipe(leads: CRMLead[]): string {
  const total = leads.reduce((s, l) => s + (l.budgetMax ?? l.budgetMin ?? 0), 0)
  if (!total) return ''
  if (total >= 1_00_00_000) return `₹${(total / 1_00_00_000).toFixed(1)} Cr`
  if (total >= 1_00_000)    return `₹${(total / 1_00_000).toFixed(0)} L`
  return `₹${total.toLocaleString('en-IN')}`
}

function timeAgo(ts: string) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000
  if (d < 60)    return 'just now'
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

function daysInStage(l: CRMLead) {
  return Math.floor((Date.now() - new Date(l.updatedAt).getTime()) / 86_400_000)
}

function getPhone(l: CRMLead): string | null {
  const p = l.phones?.primaryPhoneNumber
  return p ? p.replace(/\D/g, '').slice(-10) : null
}

function scoreColor(s: number | null | undefined) {
  const n = s ?? 0
  if (n >= 70) return BLUE
  if (n >= 40) return AMBER
  return LABEL
}

function getNextStageId(stageId: string): string | null {
  const i = STAGE_SEQUENCE.indexOf(stageId)
  return i >= 0 && i < STAGE_SEQUENCE.length - 1 ? STAGE_SEQUENCE[i + 1] : null
}

// ─── Mock fallback ─────────────────────────────────────────────────────────────
const NF = { sourceDetail: null, leadPortalId: null, propertyType: null, timeline: null, localities: null, escalated: false }
const P  = (n: string) => ({ primaryPhoneNumber: n, primaryPhoneCountryCode: 'IN' as const })
const E  = (e: string) => ({ primaryEmail: e })

const MOCK_LEADS: CRMLead[] = [
  { ...NF, id: 'm1',  name: { firstName: 'Rahul',   lastName: 'Mehta'  }, phones: P('+919820001111'), emails: E('rahul@x.in'),   city: 'Mumbai',    intentScore: 88, sourcePortal: 'MagicBricks', status: 'Fresh',           leadPortalId: 'CS00001', budgetMin: 80_00_000,  budgetMax: 1_20_00_000, createdAt: new Date(Date.now() - 1*3600000).toISOString(),    updatedAt: new Date(Date.now() - 1*3600000).toISOString()    },
  { ...NF, id: 'm2',  name: { firstName: 'Priya',   lastName: 'Sharma' }, phones: P('+919820002222'), emails: E('priya@x.in'),   city: 'Pune',      intentScore: 72, sourcePortal: '99acres',     status: 'Fresh',           leadPortalId: 'CS00002', budgetMin: 50_00_000,  budgetMax: 75_00_000,   createdAt: new Date(Date.now() - 3*3600000).toISOString(),    updatedAt: new Date(Date.now() - 3*3600000).toISOString()    },
  { ...NF, id: 'm3',  name: { firstName: 'Arjun',   lastName: 'Kapoor' }, phones: P('+919820003333'), emails: E('arjun@x.in'),   city: 'Bangalore', intentScore: 55, sourcePortal: 'Housing.com', status: 'Attempting',      leadPortalId: 'CS00003', budgetMin: 40_00_000,  budgetMax: 60_00_000,   createdAt: new Date(Date.now() - 2*86400000).toISOString(),   updatedAt: new Date(Date.now() - 8*86400000).toISOString()   },
  { ...NF, id: 'm4',  name: { firstName: 'Sneha',   lastName: 'Nair'   }, phones: P('+919820004444'), emails: E('sneha@x.in'),   city: 'Mumbai',    intentScore: 65, sourcePortal: 'NoBroker',    status: 'Attempting',      leadPortalId: 'CS00004', budgetMin: 90_00_000,  budgetMax: null,         createdAt: new Date(Date.now() - 3*86400000).toISOString(),   updatedAt: new Date(Date.now() - 3*86400000).toISOString()   },
  { ...NF, id: 'm5',  name: { firstName: 'Vikram',  lastName: 'Singh'  }, phones: P('+919820005555'), emails: E('vikram@x.in'),  city: 'Hyderabad', intentScore: 40, sourcePortal: 'MagicBricks', status: 'VM Done',         leadPortalId: 'CS00005', budgetMin: 30_00_000,  budgetMax: 45_00_000,   createdAt: new Date(Date.now() - 4*86400000).toISOString(),   updatedAt: new Date(Date.now() - 10*86400000).toISOString()  },
  { ...NF, id: 'm6',  name: { firstName: 'Anjali',  lastName: 'Desai'  }, phones: P('+919820006666'), emails: E('anjali@x.in'),  city: 'Pune',      intentScore: 78, sourcePortal: '99acres',     status: 'VM Done',         leadPortalId: 'CS00006', budgetMin: 65_00_000,  budgetMax: 80_00_000,   createdAt: new Date(Date.now() - 60*3600000).toISOString(),   updatedAt: new Date(Date.now() - 2*86400000).toISOString()   },
  { ...NF, id: 'm7',  name: { firstName: 'Rohan',   lastName: 'Gupta'  }, phones: P('+919820007777'), emails: E('rohan@x.in'),   city: 'Chennai',   intentScore: 82, sourcePortal: 'Direct',      status: 'Connected',       leadPortalId: 'CS00007', budgetMin: 1_00_00_000,budgetMax: 1_50_00_000, createdAt: new Date(Date.now() - 5*86400000).toISOString(),   updatedAt: new Date(Date.now() - 9*86400000).toISOString()   },
  { ...NF, id: 'm8',  name: { firstName: 'Kavya',   lastName: 'Reddy'  }, phones: P('+919820008888'), emails: E('kavya@x.in'),   city: 'Bangalore', intentScore: 60, sourcePortal: 'Housing.com', status: 'Connected',       leadPortalId: 'CS00008', budgetMin: 55_00_000,  budgetMax: 70_00_000,   createdAt: new Date(Date.now() - 2*86400000).toISOString(),   updatedAt: new Date(Date.now() - 2*86400000).toISOString()   },
  { ...NF, id: 'm9',  name: { firstName: 'Aditya',  lastName: 'Joshi'  }, phones: P('+919820009999'), emails: E('aditya@x.in'),  city: 'Mumbai',    intentScore: 91, sourcePortal: 'MagicBricks', status: 'Virtual Meeting', leadPortalId: 'CS00009', budgetMin: 2_00_00_000,budgetMax: 2_50_00_000, createdAt: new Date(Date.now() - 6*86400000).toISOString(),   updatedAt: new Date(Date.now() - 4*86400000).toISOString()   },
  { ...NF, id: 'm10', name: { firstName: 'Divya',   lastName: 'Iyer'   }, phones: P('+919820010000'), emails: E('divya@x.in'),   city: 'Pune',      intentScore: 74, sourcePortal: '99acres',     status: 'Site Visit',      leadPortalId: 'CS00010', budgetMin: 75_00_000,  budgetMax: 1_00_00_000, createdAt: new Date(Date.now() - 7*86400000).toISOString(),   updatedAt: new Date(Date.now() - 7*86400000).toISOString()   },
  { ...NF, id: 'm11', name: { firstName: 'Suresh',  lastName: 'Kumar'  }, phones: P('+919820011000'), emails: E('suresh@x.in'),  city: 'Hyderabad', intentScore: 85, sourcePortal: 'Direct',      status: 'Site Visit',      leadPortalId: 'CS00011', budgetMin: 1_20_00_000,budgetMax: 1_50_00_000, createdAt: new Date(Date.now() - 3*86400000).toISOString(),   updatedAt: new Date(Date.now() - 3*86400000).toISOString()   },
  { ...NF, id: 'm12', name: { firstName: 'Meera',   lastName: 'Pillai' }, phones: P('+919820012000'), emails: E('meera@x.in'),   city: 'Chennai',   intentScore: 93, sourcePortal: 'MagicBricks', status: 'Negotiation',     leadPortalId: 'CS00012', budgetMin: 1_80_00_000,budgetMax: 2_00_00_000, createdAt: new Date(Date.now() - 10*86400000).toISOString(),  updatedAt: new Date(Date.now() - 12*86400000).toISOString()  },
  { ...NF, id: 'm13', name: { firstName: 'Karthik', lastName: 'Balan'  }, phones: P('+919820013000'), emails: E('karthik@x.in'), city: 'Bangalore', intentScore: 95, sourcePortal: '99acres',     status: 'Won',             leadPortalId: 'CS00013', budgetMin: 3_00_00_000,budgetMax: 3_50_00_000, createdAt: new Date(Date.now() - 14*86400000).toISOString(),  updatedAt: new Date(Date.now() - 1*86400000).toISOString()   },
  { ...NF, id: 'm14', name: { firstName: 'Nisha',   lastName: 'Verma'  }, phones: P('+919820014000'), emails: E('nisha@x.in'),   city: 'Mumbai',    intentScore: 30, sourcePortal: 'NoBroker',    status: 'Lost',            leadPortalId: 'CS00014', budgetMin: 20_00_000,  budgetMax: null,         createdAt: new Date(Date.now() - 8*86400000).toISOString(),   updatedAt: new Date(Date.now() - 8*86400000).toISOString()   },
  { ...NF, id: 'm15', name: { firstName: 'Prakash', lastName: 'Rao'    }, phones: P('+919820015000'), emails: E('prakash@x.in'), city: 'Pune',      intentScore: 20, sourcePortal: 'Housing.com', status: 'NC',              leadPortalId: 'CS00015', budgetMin: null,        budgetMax: null,         createdAt: new Date(Date.now() - 12*86400000).toISOString(),  updatedAt: new Date(Date.now() - 12*86400000).toISOString()  },
]

// ─── Filter types ──────────────────────────────────────────────────────────────
const SOURCE_OPTIONS = ['99acres', 'MagicBricks', 'Housing.com', 'NoBroker', 'Direct']
type FilterState = { source: string; score: string; stuck: boolean }

function applyFilters(leads: CRMLead[], filters: FilterState): CRMLead[] {
  let r = leads
  if (filters.source) r = r.filter(l => l.sourcePortal === filters.source)
  if (filters.score === 'high')   r = r.filter(l => (l.intentScore ?? 0) >= 70)
  if (filters.score === 'medium') r = r.filter(l => (l.intentScore ?? 0) >= 40 && (l.intentScore ?? 0) < 70)
  if (filters.score === 'low')    r = r.filter(l => (l.intentScore ?? 0) < 40)
  if (filters.stuck) r = r.filter(l => {
    const terminal = ['Won', 'Lost', 'NC'].includes(l.status ?? '')
    return !terminal && daysInStage(l) >= 7
  })
  return r
}

// ─── Filters Bar ───────────────────────────────────────────────────────────────
function FiltersBar({ filters, onChange }: { filters: FilterState; onChange: (f: FilterState) => void }) {
  const activeCount = [filters.source !== '', filters.score !== '', filters.stuck].filter(Boolean).length

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{
      fontSize: 11, fontWeight: active ? 700 : 500,
      padding: '4px 10px', borderRadius: 2,
      border: `1px solid ${active ? BLUE : BORDER}`,
      background: active ? BLUE_DIM : 'transparent',
      color: active ? BLUE : MUTED, cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 28px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: MUTED, flexShrink: 0 }}>
        <Funnel size={12} weight="light" />
        <span style={{ fontSize: 11, fontWeight: 600 }}>Filter</span>
        {activeCount > 0 && (
          <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', background: BLUE, color: '#fff', borderRadius: 999 }}>{activeCount}</span>
        )}
      </div>

      <div style={{ width: 1, height: 14, background: BORDER, flexShrink: 0 }} />

      {SOURCE_OPTIONS.map(s => chip(s, filters.source === s, () => onChange({ ...filters, source: filters.source === s ? '' : s })))}

      <div style={{ width: 1, height: 14, background: BORDER, flexShrink: 0 }} />

      {chip('AI 70+', filters.score === 'high',   () => onChange({ ...filters, score: filters.score === 'high'   ? '' : 'high'   }))}
      {chip('AI 40–69', filters.score === 'medium', () => onChange({ ...filters, score: filters.score === 'medium' ? '' : 'medium' }))}

      <div style={{ width: 1, height: 14, background: BORDER, flexShrink: 0 }} />

      {chip('Stuck 7d+', filters.stuck, () => onChange({ ...filters, stuck: !filters.stuck }))}

      {activeCount > 0 && (
        <button onClick={() => onChange({ source: '', score: '', stuck: false })}
          style={{ fontSize: 11, color: RED, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '4px 4px', marginLeft: 4 }}>
          Clear all
        </button>
      )}
    </div>
  )
}

// ─── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({
  lead, bucket, currentStage, onStageChange, onReassign, overlay = false, compact = false, highlighted = false,
}: {
  lead: CRMLead; bucket: Bucket; currentStage: Stage
  onStageChange?: (leadId: string, newStageId: string) => void
  onReassign?: (leadId: string) => void
  overlay?: boolean; compact?: boolean; highlighted?: boolean
}) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })

  const isTerminal  = ['Won', 'Lost', 'NC'].includes(currentStage.id)
  const stuckDays   = daysInStage(lead)
  const isStuck     = !isTerminal && stuckDays >= 7
  const isVeryStuck = !isTerminal && stuckDays >= 14
  const phone       = getPhone(lead)
  const budget      = formatBudget(lead.budgetMin ?? null, lead.budgetMax ?? null)
  const av          = avatarColor(fname(lead))
  const nextStage   = getNextStageId(currentStage.id)
  const stuckColor  = isVeryStuck ? RED : AMBER

  const borderColor = isDragging || highlighted ? bucket.color : isStuck ? stuckColor : BORDER

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => !overlay && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: PANEL,
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${bucket.color}`,
        borderRadius: 2,
        padding: compact ? '8px 10px' : '12px 13px 10px',
        cursor: overlay ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.3 : 1,
        transform: overlay ? undefined : CSS.Translate.toString(transform),
        userSelect: 'none', touchAction: 'none',
        transition: 'border-color 0.12s',
      }}
      {...(overlay ? {} : { ...attributes, ...listeners })}
    >
      {/* Header: avatar + name + score chip */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: compact ? 4 : 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 2, background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: av.fg }}>{getInitials(lead)}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 13, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25, cursor: 'pointer' }}
            onClick={overlay ? undefined : e => { e.stopPropagation(); router.push(`/dashboard/leads/${lead.id}`) }}
          >
            {fname(lead)}
          </div>
          {!compact && <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>{lead.city ?? '—'}</div>}
        </div>
        {lead.intentScore != null && (
          <div style={{
            fontSize: 10, fontWeight: 800,
            color: scoreColor(lead.intentScore),
            background: `${scoreColor(lead.intentScore)}12`,
            border: `1px solid ${scoreColor(lead.intentScore)}28`,
            padding: '2px 6px', borderRadius: 2, flexShrink: 0,
          }}>
            {lead.intentScore}
          </div>
        )}
      </div>

      {!compact && (
        <>
          {/* Budget + source badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            {budget
              ? <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, letterSpacing: '-0.02em' }}>{budget}</span>
              : <span style={{ fontSize: 10, color: LABEL }}>No budget</span>}
            {lead.sourcePortal && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: MUTED,
                background: BG, border: `1px solid ${BORDER}`,
                padding: '2px 6px', borderRadius: 2,
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {lead.sourcePortal}
              </span>
            )}
          </div>

          {/* Days in stage + last activity timestamp */}
          {!isTerminal && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isStuck
                  ? <Warning size={10} weight="light" style={{ color: stuckColor, flexShrink: 0 }} />
                  : <Clock size={10} weight="light" style={{ color: LABEL, flexShrink: 0 }} />}
                <span style={{ fontSize: 10, color: isStuck ? stuckColor : MUTED, fontWeight: isStuck ? 700 : 400 }}>
                  {stuckDays === 0 ? 'Today' : `${stuckDays}d in stage`}
                  {isVeryStuck ? ' · urgent' : isStuck ? ' · stuck' : ''}
                </span>
              </div>
              <span style={{ fontSize: 10, color: LABEL }}>{timeAgo(lead.updatedAt)}</span>
            </div>
          )}

          {/* Sub-stage pills */}
          {!overlay && bucket.stages.length > 1 && onStageChange && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${BORDER}` }}>
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
                      fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 2,
                      border: `1px solid ${active ? s.color : BORDER}`,
                      background: active ? `${s.color}12` : 'transparent',
                      color: active ? s.color : MUTED,
                      cursor: active ? 'default' : 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Quick actions: Call + WhatsApp always; Next + Reassign on hover */}
          {!overlay && (phone || (hovered && onReassign)) && (
            <div style={{ display: 'flex', gap: 4 }}
              onPointerDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}>
              {phone && (
                <>
                  <a href={`tel:+91${phone}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 2, background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.18)', textDecoration: 'none', flex: 1, justifyContent: 'center' }}>
                    <Phone size={11} weight="light" style={{ color: EMERALD }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: EMERALD }}>Call</span>
                  </a>
                  <a href={`https://wa.me/91${phone}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 2, background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.18)', textDecoration: 'none', flex: 1, justifyContent: 'center' }}>
                    <WhatsappLogo size={11} weight="light" style={{ color: '#25D366' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#25D366' }}>WhatsApp</span>
                  </a>
                </>
              )}
              {hovered && nextStage && onStageChange && (
                <button
                  title="Move to next stage"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onStageChange(lead.id, nextStage) }}
                  style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, background: BLUE_DIM, border: `1px solid rgba(29,78,216,0.18)`, cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                  <ArrowCircleRight size={12} weight="light" style={{ color: BLUE }} />
                </button>
              )}
              {hovered && onReassign && (
                <button
                  title="Reassign lead"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onReassign(lead.id) }}
                  style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, background: 'rgba(124,58,237,0.06)', border: `1px solid rgba(124,58,237,0.18)`, cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                  <UserSwitch size={12} weight="light" style={{ color: '#7C3AED' }} />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Bucket Column ─────────────────────────────────────────────────────────────
function BucketColumn({
  bucket, leads, onStageChange, onReassign, activeId, csSearch, onCsSearch,
  isSearchOpen, onOpenSearch, onCloseSearch, highlightId,
  compact = false, collapsed = false, onToggleCollapse,
}: {
  bucket: Bucket; leads: CRMLead[]
  onStageChange: (leadId: string, newStageId: string) => void
  onReassign?: (leadId: string) => void
  activeId: string | null; csSearch?: string; onCsSearch?: (v: string) => void
  isSearchOpen?: boolean; onOpenSearch?: () => void; onCloseSearch?: () => void
  highlightId?: string | null; compact?: boolean
  collapsed?: boolean; onToggleCollapse?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.id })
  const inputRef = useRef<HTMLInputElement>(null)
  const pipeValue  = formatPipe(leads)
  const stuckCount = leads.filter(l => !['Won', 'Lost', 'NC'].includes(l.status ?? '') && daysInStage(l) >= 7).length

  useEffect(() => { if (isSearchOpen) inputRef.current?.focus() }, [isSearchOpen])

  if (collapsed) {
    return (
      <div style={{ width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div
          onClick={onToggleCollapse}
          style={{ width: '100%', background: PANEL, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${bucket.color}`, borderRadius: 2, padding: '12px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <CaretRight size={12} weight="light" style={{ color: bucket.color }} />
          <div style={{ writingMode: 'vertical-rl', fontSize: 11, fontWeight: 700, color: bucket.color, transform: 'rotate(180deg)', letterSpacing: '0.04em' }}>
            {bucket.label}
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: bucket.color, borderRadius: 999, padding: '1px 5px', minWidth: 18, textAlign: 'center' }}>
            {leads.length}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: compact ? '100%' : 248, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

      {/* Column header */}
      <div style={{
        background: PANEL,
        border: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${bucket.color}`,
        borderBottom: 'none',
        borderRadius: '2px 2px 0 0',
        padding: compact ? '8px 10px' : '11px 14px',
      }}>
        {isSearchOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MagnifyingGlass size={12} weight="light" style={{ color: bucket.color, flexShrink: 0 }} />
            <input ref={inputRef} value={csSearch ?? ''} onChange={e => onCsSearch?.(e.target.value.toUpperCase())}
              placeholder="Search CS ID…"
              style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', background: 'transparent', color: TEXT, minWidth: 0 }} />
            <button onPointerDown={e => e.stopPropagation()} onClick={() => { onCsSearch?.(''); onCloseSearch?.() }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: MUTED, display: 'flex', flexShrink: 0 }}>
              <X size={12} weight="light" />
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 0 : 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: bucket.color, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{bucket.label}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: bucket.color, borderRadius: 999, padding: '1px 6px' }}>
                  {leads.length}
                </span>
                {stuckCount > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: AMBER, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 999, padding: '1px 5px' }}>
                    {stuckCount} stuck
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {onToggleCollapse && (
                  <button onPointerDown={e => e.stopPropagation()} onClick={onToggleCollapse}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', color: MUTED, display: 'flex', borderRadius: 2 }}>
                    <CaretDown size={11} weight="light" />
                  </button>
                )}
                {!compact && (
                  <button onPointerDown={e => e.stopPropagation()} onClick={onOpenSearch}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', color: MUTED, display: 'flex', borderRadius: 2 }}>
                    <MagnifyingGlass size={11} weight="light" />
                  </button>
                )}
              </div>
            </div>
            {!compact && (
              <div style={{ fontSize: 12, fontWeight: 700, color: pipeValue ? TEXT : LABEL, letterSpacing: '-0.02em' }}>
                {pipeValue || 'No budget data'}
              </div>
            )}
          </>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        style={{
          background: isOver ? `${bucket.color}10` : bucket.lightBg,
          border: `1px solid ${isOver ? bucket.color : BORDER}`,
          borderTop: 'none',
          borderRadius: '0 0 2px 2px',
          padding: compact ? 6 : 8,
          display: 'flex', flexDirection: 'column', gap: compact ? 5 : 8,
          minHeight: compact ? 80 : 200,
          transition: 'background 0.12s, border-color 0.12s',
        }}
      >
        {leads.length === 0 && !isOver ? (
          <div style={{ textAlign: 'center', padding: compact ? '16px 4px' : '28px 12px', color: LABEL, pointerEvents: 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 500 }}>{activeId ? 'Drop here' : 'No leads'}</div>
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
                onReassign={onReassign}
                compact={compact}
                highlighted={lead.id === highlightId}
              />
            )
          })
        )}
        {isOver && leads.length > 0 && (
          <div style={{ height: 2, borderRadius: 1, background: bucket.color, opacity: 0.6 }} />
        )}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function LifecyclePage() {
  const [leads,    setLeads]    = useState<CRMLead[]>([])
  const [loading,  setLoading]  = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [csSearch,       setCsSearch]       = useState('')
  const [searchBucketId, setSearchBucketId] = useState<string | null>(null)
  const [filters,  setFilters]  = useState<FilterState>({ source: '', score: '', stuck: false })
  const [disqExpanded, setDisqExpanded] = useState(false)
  const [reassignLeadId, setReassignLeadId] = useState<string | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check(); window.addEventListener('resize', check)
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
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStageId, updatedAt: new Date().toISOString() } : l))
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
    const targetBucket  = BUCKETS.find(b => b.id === over.id)
    if (!targetBucket) return
    const currentBucket = getBucket(resolveStage(leads.find(l => l.id === active.id)?.status))
    if (currentBucket.id === targetBucket.id) return
    handleStageChange(active.id as string, targetBucket.primaryStage)
  }

  const searchNorm = csSearch.trim()
  const baseLeads  = searchNorm
    ? leads.filter(l => (l.leadPortalId ?? '').toUpperCase().includes(searchNorm))
    : leads

  const filteredLeads = applyFilters(baseLeads, filters)
  const highlightId   = searchNorm && filteredLeads.length === 1 ? filteredLeads[0].id : null

  const grouped = BUCKETS.reduce<Record<string, CRMLead[]>>((acc, b) => {
    acc[b.id] = filteredLeads.filter(l => getBucket(resolveStage(l.status)).id === b.id)
    return acc
  }, {})

  const totalPipe  = formatPipe(leads)
  const totalStuck = leads.filter(l => !['Won', 'Lost', 'NC'].includes(l.status ?? '') && daysInStage(l) >= 7).length
  const activeLead   = activeId ? leads.find(l => l.id === activeId) : null
  const activeBucket = activeLead ? getBucket(resolveStage(activeLead.status)) : BUCKETS[0]
  const activeStage  = activeLead ? (STAGE_MAP[resolveStage(activeLead.status)] ?? STAGES[0]) : STAGES[0]

  const activeFilterCount = [filters.source !== '', filters.score !== '', filters.stuck].filter(Boolean).length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <CircleNotch size={18} weight="light" style={{ color: BLUE, animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13, color: MUTED }}>Loading pipeline…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ minHeight: '100vh', background: BG }}>
        <PageTabBar tabs={LEADS_TABS} />

        {/* Header */}
        <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: PANEL }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: TEXT, margin: '0 0 2px', letterSpacing: '-0.03em' }}>Pipeline</h1>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
              {leads.length} leads · drag to move stages
              {searchNorm && <span style={{ marginLeft: 8, color: BLUE, fontWeight: 600 }}>· search: {searchNorm}</span>}
              {activeFilterCount > 0 && <span style={{ marginLeft: 8, color: BLUE, fontWeight: 600 }}>· {filteredLeads.length} shown</span>}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {totalPipe && (
              <div style={{ padding: '6px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                <div style={{ fontSize: 9, color: MUTED, marginBottom: 1, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total Pipeline</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>{totalPipe}</div>
              </div>
            )}
            {totalStuck > 0 && (
              <div style={{ padding: '6px 12px', background: 'rgba(245,158,11,0.06)', border: `1px solid rgba(245,158,11,0.25)`, borderRadius: 2 }}>
                <div style={{ fontSize: 9, color: AMBER, marginBottom: 1, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Needs Attention</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: AMBER, letterSpacing: '-0.02em' }}>{totalStuck} stuck</div>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <FiltersBar filters={filters} onChange={setFilters} />

        {/* AI Deal Coach */}
        <div style={{ padding: '0 28px' }}>
          <AIDealCoach leads={leads} />
        </div>

        {/* Board */}
        {isMobile ? (
          <div style={{ padding: '12px 12px 100px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {BUCKETS.map(bucket => (
              <BucketColumn key={bucket.id} bucket={bucket} leads={grouped[bucket.id] ?? []}
                onStageChange={handleStageChange} onReassign={setReassignLeadId}
                activeId={activeId} highlightId={highlightId} compact />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: 60 }}>
            <div style={{ display: 'flex', gap: 12, padding: '20px 28px', width: 'max-content', minWidth: '100%', alignItems: 'flex-start' }}>
              {BUCKETS.map(bucket => {
                const isDisq = bucket.id === 'disq'
                const isCollapsed = isDisq && !disqExpanded
                return (
                  <BucketColumn
                    key={bucket.id}
                    bucket={bucket}
                    leads={grouped[bucket.id] ?? []}
                    onStageChange={handleStageChange}
                    onReassign={setReassignLeadId}
                    activeId={activeId}
                    csSearch={csSearch}
                    onCsSearch={setCsSearch}
                    isSearchOpen={searchBucketId === bucket.id}
                    onOpenSearch={() => setSearchBucketId(bucket.id)}
                    onCloseSearch={() => { setSearchBucketId(null); setCsSearch('') }}
                    highlightId={highlightId}
                    collapsed={isCollapsed}
                    onToggleCollapse={isDisq ? () => setDisqExpanded(v => !v) : undefined}
                  />
                )
              })}
            </div>
          </div>
        )}

        <DragOverlay dropAnimation={null}>
          {activeLead ? <LeadCard lead={activeLead} bucket={activeBucket} currentStage={activeStage} overlay /> : null}
        </DragOverlay>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Reassign modal — lifted to page level so it layers above DragOverlay */}
      {reassignLeadId && (() => {
        const rl = leads.find(l => l.id === reassignLeadId)
        if (!rl) return null
        return (
          <ReassignModal
            isOpen
            onClose={() => setReassignLeadId(null)}
            leadId={reassignLeadId}
            leadName={`${rl.name?.firstName ?? ''} ${rl.name?.lastName ?? ''}`.trim()}
            onReassigned={() => setReassignLeadId(null)}
          />
        )
      })()}
    </DndContext>
  )
}
