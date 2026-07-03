/**
 * Notification helpers — read/write to the Supabase notifications table.
 *
 * Server-side writes use the admin client (service role key).
 * Reads in API routes use requireAuth() then the anon key with RLS.
 */
import { getAdminClient } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export type NotificationType =
  | 'follow_up_due'
  | 'new_lead'
  | 'hot_lead_inactive'
  | 'portal_error'
  | 'morning_digest'

export type NotificationRow = {
  id: string
  type: NotificationType
  title: string
  body: string
  lead_id: string | null
  read: boolean
  scheduled_for: string
  created_at: string
}

export type CreateNotificationParams = {
  type: NotificationType
  title: string
  body: string
  leadId?: string
  scheduledFor?: Date   // defaults to now() — pass future date for reminders
}

// ─── Write (server-side, uses service role) ──────────────────────────────────

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const admin = getAdminClient()
  if (!admin) return // no service role key — skip silently

  await admin.from('notifications').insert({
    type:          params.type,
    title:         params.title,
    body:          params.body,
    lead_id:       params.leadId ?? null,
    scheduled_for: (params.scheduledFor ?? new Date()).toISOString(),
  })
}

// ─── Read (API route context — uses session-aware client for RLS) ─────────────

export async function getNotifications(limit = 30): Promise<{
  rows: NotificationRow[]
  unreadCount: number
  error: string | null
}> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .lte('scheduled_for', now)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { rows: [], unreadCount: 0, error: error.message }

  const rows = (data ?? []) as NotificationRow[]
  const unreadCount = rows.filter(r => !r.read).length

  return { rows, unreadCount, error: null }
}

export async function markRead(id: string): Promise<void> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  await supabase.from('notifications').update({ read: true }).eq('id', id)
}

export async function markAllRead(): Promise<void> {
  const admin = getAdminClient()
  if (!admin) return
  const now = new Date().toISOString()
  await admin.from('notifications').update({ read: true }).eq('read', false).lte('scheduled_for', now)
}

// ─── Cron helper — finds due follow-ups from notification table ───────────────

export async function getDueReminders(): Promise<NotificationRow[]> {
  const admin = getAdminClient()
  if (!admin) return []

  const now = new Date().toISOString()
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const { data } = await admin
    .from('notifications')
    .select('*')
    .eq('type', 'follow_up_due')
    .eq('read', false)
    .lte('scheduled_for', now)
    .gte('scheduled_for', fifteenMinAgo) // only reminders in the last window (avoid replaying old ones)

  return (data ?? []) as NotificationRow[]
}
