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
import { Loader2, Search, X, Phone, MessageCircle, AlertTriangle, Clock } from 'lucide-react'

// ─── Design tokens (Vya Pulse) ────────────────────────────────────────────────
const BG      = '#F5F6FA'
const PANEL   = '#FFFFFF'
const BORDER  = '#E8ECF0'
const TEXT    = '#263238'
const MUTED   = '#78889B'
const LABEL   = '#A4B1BE'
const ORANGE  = '#FF7043'
const ORANGE_DIM = 'rgba(255,112,67,0.08)'
const EMERALD = '#059669'
const AMBER   = '#F59E0B'
const RED     = '#EF4444'

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage  = { id: string; label: string; color: string }
type Bucket = { id: string; label: string; color: string; lightBg: string; stages: string[]; primaryStage: string }

const STAGES: Stage[] = [
  { id: 'Fresh',           label: 'Fresh',               color: MUTED   },
  { id: 'Attempting',      label: 'Attempting',           color: '#3B82F6' },
  { id: 'VM Done',         label: 'VM Done',              color: '#3B82F6' },
  { id: 'Connected',       label: 'Connected',            color: AMBER   },
  { id: 'Virtual Meeting', label: 'Virtual Meeting Done', color: AMBER   },
  { id: 'Site Visit',      label: 'Site Visit Done',      color: ORANGE  },
  { id: 'Negotiation',     label: 'Negotiation',          color: ORANGE  },
  { id: 'Won',             label: 'Closed',               color: EMERALD },
  { id: 'Lost',            label: 'Lost',                 color: RED     },
  { id: 'NC',              label: 'NC',                   color: LABEL   },
]

const STAGE_MAP: Record<string, Stage> = Object.fromEntries(STAGES.map(s => [s.id, s]))
const STAGE_IDS = new Set(STAGES.map(s => s.id))

const BUCKETS: Bucket[] = [
  { id: 'new',  label: 'New Leads',       color: MUTED,     lightBg: 'rgba(120,136,155,0.07)', stages: ['Fresh'],                              primaryStage: 'Fresh'      },
  { id: 'cold', label: 'Cold Stage',      color: '#3B82F6', lightBg: 'rgba(59,130,246,0.07)',  stages: ['Attempting', 'VM Done'],             primaryStage: 'Attempting' },
  { id: 'warm', label: 'Warm Stage',      color: AMBER,     lightBg: 'rgba(245,158,11,0.07)',  stages: ['Connected', 'Virtual Meeting'],      primaryStage: 'Connected'  },
  { id: 'hot',  label: 'Hot Stage',       color: ORANGE,    lightBg: ORANGE_DIM,               stages: ['Site Visit', 'Negotiation', 'Won'],  primaryStage: 'Site Visit' },
  { id: 'disq', label: 'Disqualified',    color: RED,       lightBg: 'rgba(239,68,68,0.07)',   stages: ['Lost', 'NC'],                        primaryStage: 'Lost'       },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  { bg: '#FFF0EB', fg: '#FF7043' }, { bg: '#FFF8E7', fg: '#F59E0B' },
  { bg: '#ECFDF5', fg: '#059669' }, { bg: '#EFF6FF', fg: '#3B82F6' },
  { bg: '#F5F3FF', fg: '#8B5CF6' }, { bg: '#FFF1F2', fg: '#EF4444' },
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
  if (n >= 70) return ORANGE
  if (n >= 40) return AMBER
  return LABEL
}

// ─── Mock fallback ─────────────────────────────────────────────────────────────
const NF = { sourceDetail: null, leadPortalId: null, propertyType: null, timeline: null, localities: null }
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

// ─── Lead Card ────────────────────────────────────────────────────────────────
function LeadCard({
  lead, bucket, currentStage, onStageChange, overlay = false, compact = false, highlighted = false,
}: {
  lead: CRMLead; bucket: Bucket; currentStage: Stage
  onStageChange?: (leadId: string, newStageId: string) => void
  overlay?: boolean; compact?: boolean; highlighted?: boolean
}) {
  const router   = useRouter()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  const isTerminal = ['Won', 'Lost', 'NC'].includes(currentStage.id)
  const stuckDays  = daysInStage(lead)
  const isStuck    = !isTerminal && stuckDays >= 7
  const isVeryStuck = !isTerminal && stuckDays >= 14
  const phone   = getPhone(lead)
  const budget  = formatBudget(lead.budgetMin ?? null, lead.budgetMax ?? null)
  const av      = avatarColor(fname(lead))

  const stuckColor = isVeryStuck ? RED : ORANGE

  return (
    <div
      ref={setNodeRef}
      style={{
        background: PANEL,
        borderTop: `1px solid ${isDragging ? bucket.color : highlighted ? bucket.color : BORDER}`,
        borderRight: `1px solid ${isDragging ? bucket.color : highlighted ? bucket.color : BORDER}`,
        borderBottom: `1px solid ${isDragging ? bucket.color : highlighted ? bucket.color : BORDER}`,
        borderLeft: isStuck ? `3px solid ${stuckColor}` : `3px solid ${highlighted ? bucket.color : 'transparent'}`,
        borderRadius: 12,
        padding: compact ? '8px 10px' : '13px 14px 11px',
        cursor: overlay ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.3 : 1,
        boxShadow: overlay
          ? '0 16px 40px rgba(0,0,0,0.16)'
          : isStuck
            ? `0 2px 8px ${stuckColor}18`
            : highlighted ? `0 0 0 2px ${bucket.color}40` : '0 1px 3px rgba(0,0,0,0.04)',
        transform: overlay ? undefined : CSS.Translate.toString(transform),
        userSelect: 'none', touchAction: 'none',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      {...(overlay ? {} : { ...attributes, ...listeners })}
    >
      {/* Top row — avatar + name + score */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: compact ? 4 : 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: av.fg }}>{getInitials(lead)}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 13, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', lineHeight: 1.2 }}
            onClick={overlay ? undefined : e => { e.stopPropagation(); router.push(`/dashboard/leads/${lead.id}`) }}
          >
            {fname(lead)}
          </div>
          {!compact && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{lead.city ?? '—'}</div>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(lead.intentScore), background: `${scoreColor(lead.intentScore)}18`, padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>
          {lead.intentScore ?? '—'}
        </span>
      </div>

      {/* Budget + source */}
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          {budget
            ? <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{budget}</span>
            : <span style={{ fontSize: 11, color: LABEL }}>No budget</span>}
          {lead.sourcePortal && (
            <span style={{ fontSize: 10, color: MUTED, background: BG, border: `1px solid ${BORDER}`, padding: '2px 7px', borderRadius: 6 }}>
              {lead.sourcePortal}
            </span>
          )}
        </div>
      )}

      {/* Days in stage + stuck warning */}
      {!compact && !isTerminal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
          {isStuck ? (
            <AlertTriangle style={{ width: 11, height: 11, color: stuckColor, flexShrink: 0 }} />
          ) : (
            <Clock style={{ width: 11, height: 11, color: LABEL, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 11, color: isStuck ? stuckColor : MUTED, fontWeight: isStuck ? 600 : 400 }}>
            {stuckDays === 0 ? 'Moved today' : `${stuckDays}d in this stage`}
            {isVeryStuck ? ' · urgent' : isStuck ? ' · needs attention' : ''}
          </span>
        </div>
      )}

      {/* Sub-stage pills */}
      {!overlay && !compact && bucket.stages.length > 1 && onStageChange && (
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
                  fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                  border: `1px solid ${active ? s.color : BORDER}`,
                  background: active ? `${s.color}18` : 'transparent',
                  color: active ? s.color : MUTED,
                  cursor: active ? 'default' : 'pointer',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Quick actions */}
      {!overlay && !compact && phone && (
        <div style={{ display: 'flex', gap: 6 }}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}>
          <a
            href={`tel:+91${phone}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.18)', textDecoration: 'none', flex: 1, justifyContent: 'center' }}>
            <Phone style={{ width: 11, height: 11, color: EMERALD }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: EMERALD }}>Call</span>
          </a>
          <a
            href={`https://wa.me/91${phone}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.18)', textDecoration: 'none', flex: 1, justifyContent: 'center' }}>
            <MessageCircle style={{ width: 11, height: 11, color: '#16A34A' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A' }}>WhatsApp</span>
          </a>
        </div>
      )}
    </div>
  )
}

// ─── Bucket Column ────────────────────────────────────────────────────────────
function BucketColumn({
  bucket, leads, onStageChange, activeId, csSearch, onCsSearch,
  isSearchOpen, onOpenSearch, onCloseSearch, highlightId, compact = false,
}: {
  bucket: Bucket; leads: CRMLead[]
  onStageChange: (leadId: string, newStageId: string) => void
  activeId: string | null; csSearch?: string; onCsSearch?: (v: string) => void
  isSearchOpen?: boolean; onOpenSearch?: () => void; onCloseSearch?: () => void
  highlightId?: string | null; compact?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.id })
  const inputRef = useRef<HTMLInputElement>(null)
  const pipeValue = formatPipe(leads)
  const stuckCount = leads.filter(l => !['Won','Lost','NC'].includes(l.status ?? '') && daysInStage(l) >= 7).length

  useEffect(() => { if (isSearchOpen) inputRef.current?.focus() }, [isSearchOpen])

  return (
    <div style={{ width: compact ? '100%' : 256, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

      {/* Column header */}
      <div style={{
        background: PANEL,
        borderTop: `1px solid ${BORDER}`,
        borderRight: `1px solid ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${bucket.color}`,
        borderRadius: '12px 12px 0 0',
        padding: compact ? '8px 10px' : '12px 16px',
      }}>
        {isSearchOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search style={{ width: 12, height: 12, color: bucket.color, flexShrink: 0 }} />
            <input ref={inputRef} value={csSearch ?? ''} onChange={e => onCsSearch?.(e.target.value.toUpperCase())}
              placeholder="Search CS ID…"
              style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', background: 'transparent', color: TEXT, minWidth: 0 }} />
            <button onPointerDown={e => e.stopPropagation()} onClick={() => { onCsSearch?.(''); onCloseSearch?.() }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: MUTED, display: 'flex', flexShrink: 0 }}>
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 0 : 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: bucket.color }}>{bucket.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: bucket.color, borderRadius: 20, padding: '1px 7px' }}>
                  {leads.length}
                </span>
                {stuckCount > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: ORANGE, background: ORANGE_DIM, borderRadius: 20, padding: '1px 6px' }}>
                    {stuckCount} stuck
                  </span>
                )}
              </div>
              {!compact && (
                <button onPointerDown={e => e.stopPropagation()} onClick={onOpenSearch}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', color: MUTED, display: 'flex', borderRadius: 4 }}>
                  <Search style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>
            {!compact && pipeValue && (
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, letterSpacing: '-0.02em' }}>{pipeValue}</div>
            )}
            {!compact && !pipeValue && (
              <div style={{ fontSize: 11, color: LABEL }}>No budget data</div>
            )}
          </>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        style={{
          background: isOver ? `${bucket.color}14` : bucket.lightBg,
          border: `1px solid ${isOver ? bucket.color : BORDER}`,
          borderTop: 'none', borderRadius: '0 0 12px 12px',
          padding: compact ? 6 : 10,
          display: 'flex', flexDirection: 'column', gap: compact ? 6 : 9,
          minHeight: compact ? 80 : 220,
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {leads.length === 0 && !isOver ? (
          <div style={{ textAlign: 'center', padding: compact ? '16px 4px' : '32px 12px', color: LABEL, pointerEvents: 'none' }}>
            <div style={{ fontSize: 22, marginBottom: 6, opacity: 0.4 }}>
              {bucket.id === 'new' ? '📥' : bucket.id === 'cold' ? '❄️' : bucket.id === 'warm' ? '🌤️' : bucket.id === 'hot' ? '🔥' : '🚫'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500 }}>{activeId ? 'Drop here' : 'No leads here'}</div>
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
        {isOver && leads.length > 0 && (
          <div style={{ height: 3, borderRadius: 2, background: bucket.color, opacity: 0.5 }} />
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
  const [isMobile, setIsMobile] = useState(false)
  const [csSearch,       setCsSearch]       = useState('')
  const [searchBucketId, setSearchBucketId] = useState<string | null>(null)

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

  const searchNorm    = csSearch.trim()
  const filteredLeads = searchNorm
    ? leads.filter(l => (l.leadPortalId ?? '').toUpperCase().includes(searchNorm))
    : leads
  const highlightId = searchNorm && filteredLeads.length === 1 ? filteredLeads[0].id : null

  const grouped = BUCKETS.reduce<Record<string, CRMLead[]>>((acc, b) => {
    acc[b.id] = filteredLeads.filter(l => getBucket(resolveStage(l.status)).id === b.id)
    return acc
  }, {})

  const totalPipe    = formatPipe(leads)
  const totalStuck   = leads.filter(l => !['Won','Lost','NC'].includes(l.status ?? '') && daysInStage(l) >= 7).length
  const activeLead   = activeId ? leads.find(l => l.id === activeId) : null
  const activeBucket = activeLead ? getBucket(resolveStage(activeLead.status)) : BUCKETS[0]
  const activeStage  = activeLead ? (STAGE_MAP[resolveStage(activeLead.status)] ?? STAGES[0]) : STAGES[0]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <Loader2 style={{ width: 20, height: 20, color: ORANGE, animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 14, color: MUTED }}>Loading lifecycle…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ minHeight: '100vh', background: BG }}>

        {/* Header */}
        <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 4px', letterSpacing: '-0.03em' }}>Lead Lifecycle</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              {leads.length} leads · drag cards to move between stages
              {searchNorm && <span style={{ marginLeft: 8, color: ORANGE, fontWeight: 600 }}>· filtering: {searchNorm}</span>}
            </p>
          </div>

          {/* Summary chips */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {totalPipe && (
              <div style={{ padding: '7px 14px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 1 }}>Total Pipeline</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>{totalPipe}</div>
              </div>
            )}
            {totalStuck > 0 && (
              <div style={{ padding: '7px 14px', background: ORANGE_DIM, border: `1px solid rgba(255,112,67,0.25)`, borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: ORANGE, marginBottom: 1 }}>Needs Attention</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: ORANGE, letterSpacing: '-0.02em' }}>{totalStuck} leads stuck 7d+</div>
              </div>
            )}
            {/* Stage legend */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {BUCKETS.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: b.color }} />
                  <span style={{ fontSize: 10, color: MUTED }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Board */}
        {isMobile ? (
          <div style={{ padding: '12px 12px 100px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {BUCKETS.map(bucket => (
              <BucketColumn key={bucket.id} bucket={bucket} leads={grouped[bucket.id] ?? []}
                onStageChange={handleStageChange} activeId={activeId} highlightId={highlightId} compact />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: 60 }}>
            <div style={{ display: 'flex', gap: 14, padding: '20px 28px', width: 'max-content', minWidth: '100%' }}>
              {BUCKETS.map(bucket => (
                <BucketColumn
                  key={bucket.id} bucket={bucket} leads={grouped[bucket.id] ?? []}
                  onStageChange={handleStageChange} activeId={activeId}
                  csSearch={csSearch} onCsSearch={setCsSearch}
                  isSearchOpen={searchBucketId === bucket.id}
                  onOpenSearch={() => setSearchBucketId(bucket.id)}
                  onCloseSearch={() => { setSearchBucketId(null); setCsSearch('') }}
                  highlightId={highlightId}
                />
              ))}
            </div>
          </div>
        )}

        <DragOverlay dropAnimation={null}>
          {activeLead ? <LeadCard lead={activeLead} bucket={activeBucket} currentStage={activeStage} overlay /> : null}
        </DragOverlay>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </DndContext>
  )
}
