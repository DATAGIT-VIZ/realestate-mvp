/**
 * resolveLeadState — pure state machine for lead lifecycle.
 * No DB calls. Caller fetches data; this function computes the outcome.
 * Authoritative spec: LIFECYCLE_SPEC.md §7
 */

// ─── Status ordering (non-terminal only) ─────────────────────────────────────
const STATUS_ORDER = ['New', 'Cold', 'Warm', 'Hot'] as const
const TERMINAL     = new Set(['Closed', 'Disqualified'])

// One-time milestones — may not be logged twice for the same lead
const MILESTONES = new Set([
  'VM Done', 'OBM Done', 'Site Visit Done', 'EOI Received', 'Deal Closed',
])

// Activities that advance status unconditionally (outcome irrelevant)
const UNCONDITIONAL_ADVANCE: Record<string, string> = {
  'Call Missed':       'Cold',
  'WhatsApp Sent':     'Cold',
  'WhatsApp Received': 'Cold',
  'Email Sent':        'Cold',
  'Email Received':    'Cold',
  'VM Done':           'Warm',
  'OBM Done':          'Warm',
  'Site Visit Done':   'Warm',
  'EOI Received':      'Hot',
  'Deal Closed':       'Closed',
}

// Activities that advance only when outcome is NOT 'No Response'
const CONDITIONAL_ADVANCE: Record<string, string> = {
  'Call Made': 'Cold',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeadState = {
  status: string
  failed_contact_attempts: number
  hold_previous_status?: string | null
  hold_until?: string | null
}

export type ActivityInput = {
  type: string
  outcome?: string | null
  reason?: string | null
  hold_until?: string | null
  hold_reason?: string | null
}

export type StateResolution = {
  /** null = no status change needed */
  newStatus: string | null
  /** null = no change to counter */
  newFailedAttempts: number | null
  /** set when transitioning INTO Hold */
  newHoldPreviousStatus: string | null
  /** non-null = reject the write, return 409 */
  blockedReason: string | null
  /** what to log in activity_data.auditNote when status changes */
  auditNote: string | null
}

const EMPTY: StateResolution = {
  newStatus: null,
  newFailedAttempts: null,
  newHoldPreviousStatus: null,
  blockedReason: null,
  auditNote: null,
}

// ─── Main function ────────────────────────────────────────────────────────────

export function resolveLeadState(
  current: LeadState,
  activity: ActivityInput,
  existingActivityTypes: string[],
): StateResolution {

  const status     = current.status
  const isTerminal = TERMINAL.has(status)

  // ── 1. Milestone idempotency ──────────────────────────────────────────────
  if (MILESTONES.has(activity.type) && existingActivityTypes.includes(activity.type)) {
    return { ...EMPTY, blockedReason: `${activity.type} has already been logged for this lead` }
  }

  // ── 2. Terminal leads ─────────────────────────────────────────────────────
  // Notes are always allowed. Status Changed (owner reopen) is also allowed.
  // All other activity types are blocked on terminal leads.
  if (isTerminal && activity.type !== 'Note' && activity.type !== 'Status Changed') {
    return { ...EMPTY, blockedReason: `Cannot log ${activity.type} on a ${status} lead` }
  }

  // ── 3. Status Changed (owner override) ───────────────────────────────────
  if (activity.type === 'Status Changed') {
    if (!activity.reason?.trim()) {
      return { ...EMPTY, blockedReason: 'Status Changed requires a reason' }
    }
    // Caller applies the actual target status; we just validate and return audit note
    return { ...EMPTY, auditNote: activity.reason }
  }

  // ── 4. Hold ───────────────────────────────────────────────────────────────
  if (activity.type === 'Hold') {
    if (!activity.hold_until?.trim()) {
      return { ...EMPTY, blockedReason: 'Hold requires a hold_until date' }
    }
    if (!activity.hold_reason?.trim()) {
      return { ...EMPTY, blockedReason: 'Hold requires a reason' }
    }
    const holdDate = new Date(activity.hold_until)
    if (isNaN(holdDate.getTime())) {
      return { ...EMPTY, blockedReason: 'hold_until is not a valid date' }
    }
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 90)
    if (holdDate > maxDate) {
      return { ...EMPTY, blockedReason: 'Hold date cannot be more than 90 days from now' }
    }
    return {
      newStatus: 'Hold',
      newFailedAttempts: null,
      newHoldPreviousStatus: status,
      blockedReason: null,
      auditNote: `Hold until ${activity.hold_until}: ${activity.hold_reason}`,
    }
  }

  // ── 5. Note / non-advancing activities on non-terminal leads ─────────────
  if (isTerminal) {
    // Note on terminal lead — allowed, no state change
    return { ...EMPTY }
  }

  // ── 6. NC counter ─────────────────────────────────────────────────────────
  let newFailedAttempts: number | null = null

  const isNcActivity = (activity.type === 'Call Made' || activity.type === 'Call Missed')
                       && activity.outcome === 'No Response'

  if (isNcActivity) {
    const next = current.failed_contact_attempts + 1
    newFailedAttempts = next
    if (next >= 5) {
      return {
        newStatus: 'Disqualified',
        newFailedAttempts: next,
        newHoldPreviousStatus: null,
        blockedReason: null,
        auditNote: 'Auto-disqualified: 5 consecutive no-contact attempts',
      }
    }
  } else if (
    (activity.type === 'Call Made' && activity.outcome !== 'No Response') ||
    activity.type === 'WhatsApp Received'
  ) {
    // Positive/neutral call or inbound WhatsApp resets the NC counter
    if (current.failed_contact_attempts > 0) {
      newFailedAttempts = 0
    }
  }

  // ── 7. Status advancement ─────────────────────────────────────────────────
  // Determine the minimum target status this activity unlocks
  let targetStatus: string | undefined

  if (CONDITIONAL_ADVANCE[activity.type] && activity.outcome !== 'No Response') {
    targetStatus = CONDITIONAL_ADVANCE[activity.type]
  } else if (UNCONDITIONAL_ADVANCE[activity.type]) {
    targetStatus = UNCONDITIONAL_ADVANCE[activity.type]
  }

  let newStatus: string | null = null

  if (targetStatus === 'Closed') {
    newStatus = 'Closed'
  } else if (targetStatus) {
    // Resolve effective current status (Hold preserves the prior stage)
    const effectiveStatus = status === 'Hold'
      ? (current.hold_previous_status ?? 'New')
      : status

    const currentIdx = STATUS_ORDER.indexOf(effectiveStatus as typeof STATUS_ORDER[number])
    const targetIdx  = STATUS_ORDER.indexOf(targetStatus as typeof STATUS_ORDER[number])

    if (currentIdx !== -1 && targetIdx > currentIdx) {
      newStatus = targetStatus
    }
  }

  return {
    newStatus,
    newFailedAttempts,
    newHoldPreviousStatus: null,
    blockedReason: null,
    auditNote: newStatus ? `Status advanced to ${newStatus} via ${activity.type}` : null,
  }
}
