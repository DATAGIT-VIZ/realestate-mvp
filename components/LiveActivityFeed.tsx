'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { supabase } from '@/lib/supabase'
import {
  Phone, ChatCircle, EnvelopeSimple, CalendarCheck, FileText,
  ArrowFatUp, MapPin, Handshake, Lightning, ArrowsClockwise,
} from '@phosphor-icons/react'

const ACT_META: Record<string, { icon: typeof Phone; color: string; bg: string; label: string }> = {
  'Call Made':            { icon: Phone,           color: '#059669', bg: '#ECFDF5', label: 'Call made'          },
  'Call Missed':          { icon: Phone,           color: '#DC2626', bg: '#FEF2F2', label: 'Call missed'        },
  'WhatsApp Sent':        { icon: ChatCircle,      color: '#16A34A', bg: '#F0FDF4', label: 'WhatsApp sent'      },
  'WhatsApp Received':    { icon: ChatCircle,      color: '#059669', bg: '#DCFCE7', label: 'WhatsApp received'  },
  'Email Sent':           { icon: EnvelopeSimple,  color: '#1D4ED8', bg: 'rgba(29,78,216,0.07)', label: 'Email sent' },
  'Email Received':       { icon: EnvelopeSimple,  color: '#1D4ED8', bg: 'rgba(29,78,216,0.07)', label: 'Email received' },
  'Site Visit Scheduled': { icon: CalendarCheck,   color: '#D97706', bg: 'rgba(245,158,11,0.09)', label: 'Site visit scheduled' },
  'Site Visit Done':      { icon: MapPin,          color: '#1D4ED8', bg: 'rgba(29,78,216,0.07)', label: 'Site visit done' },
  'Note':                 { icon: FileText,        color: '#64748B', bg: '#F8FAFC', label: 'Note added'         },
  'Follow Up Set':        { icon: CalendarCheck,   color: '#D97706', bg: 'rgba(245,158,11,0.09)', label: 'Follow-up set' },
  'EOI Received':         { icon: Handshake,       color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', label: 'EOI received'   },
  'Deal Closed':          { icon: Handshake,       color: '#059669', bg: '#DCFCE7', label: 'Deal closed'        },
  'Escalated':            { icon: ArrowFatUp,      color: '#D97706', bg: 'rgba(245,158,11,0.09)', label: 'Escalated' },
  'Status Changed':       { icon: Lightning,       color: '#1D4ED8', bg: 'rgba(29,78,216,0.07)', label: 'Status changed' },
  'VM Done':              { icon: Phone,           color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', label: 'Video meeting done' },
  'OBM Done':             { icon: Phone,           color: '#059669', bg: '#ECFDF5', label: 'OBM done' },
}

const FALLBACK = { icon: Lightning, color: '#64748B', bg: '#F8FAFC', label: 'Activity' }

type FeedItem = {
  id: string
  lead_id: string
  lead_name: string | null
  activity_type: string
  activity_data: Record<string, unknown>
  created_at: string
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60)  return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function LiveActivityFeed({ maxItems = 20 }: { maxItems?: number }) {
  const [items,   setItems]   = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [live,    setLive]    = useState(false)
  const [parent]              = useAutoAnimate<HTMLDivElement>({ duration: 200 })
  const agentIdRef            = useRef<string | null>(null)

  const fetchRecent = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id ?? '00000000-0000-0000-0000-000000000001'
    agentIdRef.current = userId

    // Join lead_activities → leads to get lead name and filter by agent
    const { data, error } = await supabase
      .from('lead_activities')
      .select(`
        id, lead_id, activity_type, activity_data, created_at,
        leads!inner ( name, agent_id )
      `)
      .eq('leads.agent_id', userId)
      .order('created_at', { ascending: false })
      .limit(maxItems)

    if (!error && data) {
      setItems(data.map(r => ({
        id:            r.id,
        lead_id:       r.lead_id,
        lead_name:     ((r.leads as unknown) as { name: string } | null)?.name ?? null,
        activity_type: r.activity_type,
        activity_data: (r.activity_data as Record<string, unknown>) ?? {},
        created_at:    r.created_at,
      })))
    }
    setLoading(false)
  }, [maxItems])

  useEffect(() => {
    fetchRecent()

    // Subscribe to new insertions on lead_activities
    const channel = supabase
      .channel('live-activity-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_activities' },
        async (payload) => {
          const row = payload.new as {
            id: string; lead_id: string; activity_type: string
            activity_data: Record<string, unknown>; created_at: string
          }

          // Fetch lead name to verify agent ownership and get display name
          const { data: lead } = await supabase
            .from('leads')
            .select('name, agent_id')
            .eq('id', row.lead_id)
            .single()

          if (!lead) return
          if (agentIdRef.current && lead.agent_id !== agentIdRef.current &&
              agentIdRef.current !== '00000000-0000-0000-0000-000000000001') return

          const newItem: FeedItem = {
            id:            row.id,
            lead_id:       row.lead_id,
            lead_name:     (lead.name as string) ?? null,
            activity_type: row.activity_type,
            activity_data: row.activity_data ?? {},
            created_at:    row.created_at,
          }

          setLive(true)
          setTimeout(() => setLive(false), 3000)
          setItems(prev => [newItem, ...prev].slice(0, maxItems))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchRecent, maxItems])

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #DFE2ED', borderRadius: 2 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #DFE2ED' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f1729' }}>Activity Feed</span>
          {live && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#059669', background: '#DCFCE7', padding: '2px 7px', borderRadius: 20 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669', display: 'inline-block', animation: 'feed-pulse 1s infinite' }} />
              LIVE
            </span>
          )}
        </div>
        <button onClick={fetchRecent} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'transparent', border: '1px solid #DFE2ED', borderRadius: 2, color: '#6b7280', fontSize: 11, cursor: 'pointer' }}>
          <ArrowsClockwise size={11} weight="light" />
          Refresh
        </button>
      </div>

      {/* Feed list */}
      <div ref={parent} style={{ maxHeight: 360, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <div style={{ width: 18, height: 18, border: '2px solid #DFE2ED', borderTop: '2px solid #1D4ED8', borderRadius: '50%', animation: 'feed-spin 0.7s linear infinite', margin: '0 auto 10px' }} />
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</span>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <Lightning size={24} weight="light" color="#d1d5db" style={{ display: 'block', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No activities yet — log a call or send a WhatsApp to see it here.</p>
          </div>
        ) : (
          items.map((item, idx) => {
            const meta = ACT_META[item.activity_type] ?? FALLBACK
            const Icon = meta.icon
            const notes = item.activity_data.notes as string | null
            const isLast = idx === items.length - 1
            return (
              <a key={item.id} href={`/dashboard/leads/${item.lead_id}`}
                style={{ display: 'flex', gap: 12, padding: '11px 16px', textDecoration: 'none', borderBottom: isLast ? 'none' : '1px solid #f1f5f9', transition: 'background 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                {/* Icon */}
                <div style={{ width: 32, height: 32, borderRadius: 2, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} weight="light" color={meta.color} />
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0f1729', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                      {item.lead_name ?? 'Lead'}
                    </span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{meta.label}</span>
                  </div>
                  {notes && (
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {notes}
                    </p>
                  )}
                </div>
                {/* Time */}
                <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, paddingTop: 2 }}>{timeAgo(item.created_at)}</span>
              </a>
            )
          })
        )}
      </div>

      <style>{`
        @keyframes feed-spin  { to { transform: rotate(360deg) } }
        @keyframes feed-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
