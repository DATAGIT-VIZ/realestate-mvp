'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, X, Check, CheckCheck,
  Bell as BellIcon, UserPlus, Flame, AlertTriangle, Sun, Clock,
} from 'lucide-react'
import type { NotificationType } from '@/lib/notifications'

// ─── Types ────────────────────────────────────────────────────────────────────
type Notification = {
  id: string
  type: NotificationType
  title: string
  body: string
  lead_id: string | null
  read: boolean
  scheduled_for: string
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const TYPE_META: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
  follow_up_due:      { icon: Clock,         color: '#be2ed6', bg: 'rgba(190,46,214,0.1)'  },
  new_lead:           { icon: UserPlus,       color: '#a000c8', bg: 'rgba(160,0,200,0.1)'  },
  hot_lead_inactive:  { icon: Flame,          color: '#a000c8', bg: 'rgba(160,0,200,0.1)'  },
  portal_error:       { icon: AlertTriangle,  color: '#EF4444', bg: 'rgba(239,68,68,0.1)'  },
  morning_digest:     { icon: Sun,            color: '#059669', bg: 'rgba(5,150,105,0.1)'  },
}

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  /** Called by TopBar to pass the current unread count up for the badge */
  onUnreadChange?: (count: number) => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export function NotificationCenter({ onUnreadChange }: Props) {
  const router = useRouter()
  const [open, setOpen]                     = useState(false)
  const [notifications, setNotifications]   = useState<Notification[]>([])
  const [unreadCount, setUnreadCount]       = useState(0)
  const [loading, setLoading]               = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const json = await res.json()
      if (json.error) return
      const { notifications: rows, unreadCount: count } = json.data
      setNotifications(rows ?? [])
      setUnreadCount(count ?? 0)
      onUnreadChange?.(count ?? 0)
    } catch { /* silent */ }
  }, [onUnreadChange])

  // Initial fetch + poll every 60s
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggleOpen = () => {
    if (!open) fetchNotifications()
    setOpen(v => !v)
  }

  const handleMarkRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    onUnreadChange?.(Math.max(0, unreadCount - 1))
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
  }

  const handleMarkAllRead = async () => {
    setLoading(true)
    await fetch('/api/notifications/mark-all-read', { method: 'POST' })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    onUnreadChange?.(0)
    setLoading(false)
  }

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) await handleMarkRead(n.id)
    if (n.lead_id) {
      router.push(`/dashboard/leads/${n.lead_id}`)
      setOpen(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute', top: 5, right: 5,
              minWidth: 16, height: 16,
              background: '#a000c8', borderRadius: 9,
              fontSize: 9, fontWeight: 700, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px', lineHeight: 1,
              border: '1.5px solid #fff',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 8,
            width: 380, maxHeight: 520,
            background: '#FFFFFF', border: '1px solid #E2E8F0',
            borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            zIndex: 100, display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BellIcon style={{ width: 15, height: 15, color: '#64748B' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Notifications</span>
              {unreadCount > 0 && (
                <span style={{ padding: '1px 7px', background: 'rgba(160,0,200,0.1)', color: '#a000c8', borderRadius: 9, fontSize: 11, fontWeight: 700 }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'transparent', border: '1px solid #E2E8F0', borderRadius: 7, color: '#64748B', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
                >
                  <CheckCheck style={{ width: 11, height: 11 }} />
                  All read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #E2E8F0', background: 'transparent', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <Bell style={{ width: 18, height: 18, color: '#94A3B8' }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', margin: '0 0 4px' }}>All clear</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No notifications yet.</p>
              </div>
            ) : (
              notifications.map((n, idx) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.morning_digest
                const Icon = meta.icon
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      display: 'flex', gap: 11, padding: '12px 16px',
                      borderBottom: idx < notifications.length - 1 ? '1px solid #F1F5F9' : 'none',
                      background: n.read ? '#FFFFFF' : 'rgba(160,0,200,0.03)',
                      cursor: n.lead_id ? 'pointer' : 'default',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!n.read) (e.currentTarget as HTMLDivElement).style.background = 'rgba(160,0,200,0.05)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.read ? '#FFFFFF' : 'rgba(160,0,200,0.03)' }}
                  >
                    {/* Icon */}
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Icon style={{ width: 15, height: 15, color: meta.color }} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <p style={{ fontSize: 12, fontWeight: n.read ? 500 : 700, color: '#0F172A', margin: 0, lineHeight: 1.4 }}>
                          {n.title}
                        </p>
                        <span style={{ fontSize: 10, color: '#94A3B8', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1 }}>
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748B', margin: '3px 0 0', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                        {n.body}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#a000c8', flexShrink: 0, marginTop: 6 }} />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{ borderTop: '1px solid #E2E8F0', padding: '10px 16px', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => { setOpen(false); router.push('/dashboard/leads') }}
                style={{ fontSize: 12, color: '#a000c8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                View all leads →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
