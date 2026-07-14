'use client'

import Link from 'next/link'
import { type CRMLead } from '@/lib/twenty'
import { Phone, Mail } from 'lucide-react'

const COLUMNS = [
  { id: 'New',          title: 'New',          color: '#64748B', bg: '#F8FAFC' },
  { id: 'Cold',         title: 'Cold',         color: '#2563EB', bg: '#EFF6FF' },
  { id: 'Warm',         title: 'Warm',         color: '#be2ed6', bg: '#FDF4FF' },
  { id: 'Hot',          title: 'Hot 🔥',       color: '#a000c8', bg: '#FDF4FF' },
  { id: 'Closed',       title: 'Closed ✓',     color: '#059669', bg: '#F0FDF4' },
  { id: 'Disqualified', title: 'Disqualified', color: '#94A3B8', bg: '#F8FAFC' },
]

const getName  = (l: CRMLead) => `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed'
const getPhone = (l: CRMLead) => l.phones.primaryPhoneNumber ?? ''
const getScore = (l: CRMLead) => l.intentScore ?? 0

function scoreDot(score: number) {
  if (score >= 70) return '#a000c8'
  if (score >= 40) return '#be2ed6'
  return '#94A3B8'
}

function LeadCard({ lead }: { lead: CRMLead }) {
  const score = getScore(lead)
  return (
    <Link href={`/dashboard/leads/${lead.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
        padding: '10px 12px', marginBottom: 7, cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1' }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#E2E8F0' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
            {getName(lead)}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: scoreDot(score), background: `${scoreDot(score)}15`, padding: '2px 6px', borderRadius: 99, flexShrink: 0, marginLeft: 4 }}>
            {score}
          </span>
        </div>
        {getPhone(lead) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B', marginBottom: 2 }}>
            <Phone style={{ width: 10, height: 10, flexShrink: 0 }} />{getPhone(lead)}
          </div>
        )}
        {lead.city && (
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{lead.city}</div>
        )}
      </div>
    </Link>
  )
}

interface KanbanBoardProps {
  leads: CRMLead[]
  onLeadUpdate: (leadId: string, newStatus: string) => void
}

export function KanbanBoard({ leads }: KanbanBoardProps) {
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 16, height: 'calc(100vh - 240px)', minHeight: 480 }}>
      {COLUMNS.map(col => {
        const colLeads = leads.filter(l => (l.status ?? 'New') === col.id)
        return (
          <div key={col.id} style={{ flexShrink: 0, width: 240, borderRadius: 12, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', background: col.bg }}>
            {/* Column header */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: '12px 12px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{col.title}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: col.color, background: `${col.color}15`, padding: '2px 8px', borderRadius: 99 }}>
                {colLeads.length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ padding: 8, flex: 1, overflowY: 'auto' }}>
              {colLeads.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#CBD5E1', fontSize: 12 }}>
                  No leads
                </div>
              ) : (
                colLeads.map(lead => <LeadCard key={lead.id} lead={lead} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
