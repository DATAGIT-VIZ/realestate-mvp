import { describe, it, expect } from 'vitest'
import { resolveLeadState, type LeadState, type ActivityInput } from '../resolveLeadState'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function state(overrides: Partial<LeadState> = {}): LeadState {
  return {
    status: 'New',
    failed_contact_attempts: 0,
    hold_previous_status: null,
    hold_until: null,
    ...overrides,
  }
}

function act(overrides: Partial<ActivityInput> = {}): ActivityInput {
  return { type: 'Note', ...overrides }
}

// ─── §4 — Activity → State transitions ───────────────────────────────────────

describe('Call Made', () => {
  it('advances New → Cold on positive outcome', () => {
    const r = resolveLeadState(state(), act({ type: 'Call Made', outcome: 'Connected — Positive' }), [])
    expect(r.newStatus).toBe('Cold')
    expect(r.blockedReason).toBeNull()
  })

  it('advances New → Cold on neutral outcome', () => {
    const r = resolveLeadState(state(), act({ type: 'Call Made', outcome: 'Connected — Neutral' }), [])
    expect(r.newStatus).toBe('Cold')
  })

  it('does NOT advance on No Response', () => {
    const r = resolveLeadState(state(), act({ type: 'Call Made', outcome: 'No Response' }), [])
    expect(r.newStatus).toBeNull()
  })

  it('increments NC counter on No Response', () => {
    const r = resolveLeadState(state({ failed_contact_attempts: 2 }), act({ type: 'Call Made', outcome: 'No Response' }), [])
    expect(r.newFailedAttempts).toBe(3)
  })

  it('resets NC counter on positive outcome', () => {
    const r = resolveLeadState(state({ failed_contact_attempts: 3 }), act({ type: 'Call Made', outcome: 'Connected — Positive' }), [])
    expect(r.newFailedAttempts).toBe(0)
  })

  it('does not change NC counter when already 0 and positive', () => {
    const r = resolveLeadState(state({ failed_contact_attempts: 0 }), act({ type: 'Call Made', outcome: 'Connected — Positive' }), [])
    expect(r.newFailedAttempts).toBeNull()
  })

  it('does not regress status when already Cold', () => {
    const r = resolveLeadState(state({ status: 'Cold' }), act({ type: 'Call Made', outcome: 'Connected — Positive' }), [])
    expect(r.newStatus).toBeNull()
  })

  it('does not regress status when already Warm', () => {
    const r = resolveLeadState(state({ status: 'Warm' }), act({ type: 'Call Made', outcome: 'Connected — Positive' }), [])
    expect(r.newStatus).toBeNull()
  })
})

describe('Call Missed', () => {
  it('advances New → Cold unconditionally', () => {
    const r = resolveLeadState(state(), act({ type: 'Call Missed' }), [])
    expect(r.newStatus).toBe('Cold')
  })

  it('increments NC counter when outcome is No Response', () => {
    const r = resolveLeadState(state({ failed_contact_attempts: 1 }), act({ type: 'Call Missed', outcome: 'No Response' }), [])
    expect(r.newFailedAttempts).toBe(2)
    expect(r.newStatus).toBe('Cold')
  })

  it('does not increment NC counter without No Response outcome', () => {
    const r = resolveLeadState(state({ failed_contact_attempts: 1 }), act({ type: 'Call Missed' }), [])
    expect(r.newFailedAttempts).toBeNull()
  })
})

describe('WhatsApp Sent', () => {
  it('advances New → Cold', () => {
    const r = resolveLeadState(state(), act({ type: 'WhatsApp Sent' }), [])
    expect(r.newStatus).toBe('Cold')
  })
})

describe('WhatsApp Received', () => {
  it('advances New → Cold', () => {
    const r = resolveLeadState(state(), act({ type: 'WhatsApp Received' }), [])
    expect(r.newStatus).toBe('Cold')
  })

  it('resets NC counter', () => {
    const r = resolveLeadState(state({ failed_contact_attempts: 4 }), act({ type: 'WhatsApp Received' }), [])
    expect(r.newFailedAttempts).toBe(0)
  })

  it('does not change NC counter if already 0', () => {
    const r = resolveLeadState(state({ failed_contact_attempts: 0 }), act({ type: 'WhatsApp Received' }), [])
    expect(r.newFailedAttempts).toBeNull()
  })
})

describe('Email Sent / Email Received', () => {
  it('Email Sent advances New → Cold', () => {
    const r = resolveLeadState(state(), act({ type: 'Email Sent' }), [])
    expect(r.newStatus).toBe('Cold')
  })

  it('Email Received advances New → Cold', () => {
    const r = resolveLeadState(state(), act({ type: 'Email Received' }), [])
    expect(r.newStatus).toBe('Cold')
  })
})

describe('VM Done / OBM Done', () => {
  it('VM Done advances Cold → Warm', () => {
    const r = resolveLeadState(state({ status: 'Cold' }), act({ type: 'VM Done' }), [])
    expect(r.newStatus).toBe('Warm')
  })

  it('OBM Done advances Cold → Warm', () => {
    const r = resolveLeadState(state({ status: 'Cold' }), act({ type: 'OBM Done' }), [])
    expect(r.newStatus).toBe('Warm')
  })

  it('VM Done does not regress Hot → Warm', () => {
    const r = resolveLeadState(state({ status: 'Hot' }), act({ type: 'VM Done' }), [])
    expect(r.newStatus).toBeNull()
  })
})

describe('Site Visit Scheduled', () => {
  it('does not change status', () => {
    const r = resolveLeadState(state({ status: 'Cold' }), act({ type: 'Site Visit Scheduled' }), [])
    expect(r.newStatus).toBeNull()
    expect(r.newFailedAttempts).toBeNull()
    expect(r.blockedReason).toBeNull()
  })
})

describe('Site Visit Done', () => {
  it('advances Cold → Warm', () => {
    const r = resolveLeadState(state({ status: 'Cold' }), act({ type: 'Site Visit Done' }), [])
    expect(r.newStatus).toBe('Warm')
  })

  it('does not regress Hot → Warm', () => {
    const r = resolveLeadState(state({ status: 'Hot' }), act({ type: 'Site Visit Done' }), [])
    expect(r.newStatus).toBeNull()
  })
})

describe('EOI Received', () => {
  it('advances Warm → Hot', () => {
    const r = resolveLeadState(state({ status: 'Warm' }), act({ type: 'EOI Received' }), [])
    expect(r.newStatus).toBe('Hot')
  })

  it('advances Cold → Hot (skips Warm — forward-only minimum enforcement)', () => {
    const r = resolveLeadState(state({ status: 'Cold' }), act({ type: 'EOI Received' }), [])
    expect(r.newStatus).toBe('Hot')
  })

  it('does not change status when already Hot', () => {
    const r = resolveLeadState(state({ status: 'Hot' }), act({ type: 'EOI Received' }), [])
    expect(r.newStatus).toBeNull()
  })
})

describe('Deal Closed', () => {
  it('closes a Hot lead', () => {
    const r = resolveLeadState(state({ status: 'Hot' }), act({ type: 'Deal Closed' }), [])
    expect(r.newStatus).toBe('Closed')
  })

  it('closes a New lead', () => {
    const r = resolveLeadState(state({ status: 'New' }), act({ type: 'Deal Closed' }), [])
    expect(r.newStatus).toBe('Closed')
  })
})

describe('Follow Up Set / Note', () => {
  it('Follow Up Set does not change status', () => {
    const r = resolveLeadState(state({ status: 'Warm' }), act({ type: 'Follow Up Set' }), [])
    expect(r.newStatus).toBeNull()
    expect(r.blockedReason).toBeNull()
  })

  it('Note does not change status', () => {
    const r = resolveLeadState(state({ status: 'Hot' }), act({ type: 'Note' }), [])
    expect(r.newStatus).toBeNull()
    expect(r.blockedReason).toBeNull()
  })
})

// ─── §5 — NC tracking ────────────────────────────────────────────────────────

describe('NC auto-disqualify at 5', () => {
  it('disqualifies at exactly 5 NC attempts', () => {
    const r = resolveLeadState(state({ failed_contact_attempts: 4 }), act({ type: 'Call Made', outcome: 'No Response' }), [])
    expect(r.newStatus).toBe('Disqualified')
    expect(r.newFailedAttempts).toBe(5)
    expect(r.auditNote).toContain('Auto-disqualified')
  })

  it('disqualifies on Call Missed No Response at 5', () => {
    const r = resolveLeadState(state({ failed_contact_attempts: 4 }), act({ type: 'Call Missed', outcome: 'No Response' }), [])
    expect(r.newStatus).toBe('Disqualified')
  })

  it('does not disqualify at 4 (still below threshold)', () => {
    const r = resolveLeadState(state({ failed_contact_attempts: 3 }), act({ type: 'Call Made', outcome: 'No Response' }), [])
    expect(r.newStatus).toBeNull()
    expect(r.newFailedAttempts).toBe(4)
  })
})

// ─── §6 — Hold ───────────────────────────────────────────────────────────────

describe('Hold', () => {
  it('sets status to Hold and captures previous status', () => {
    const holdDate = new Date()
    holdDate.setDate(holdDate.getDate() + 30)
    const r = resolveLeadState(
      state({ status: 'Warm' }),
      act({ type: 'Hold', hold_until: holdDate.toISOString().split('T')[0], hold_reason: 'Waiting for property shortlist' }),
      [],
    )
    expect(r.newStatus).toBe('Hold')
    expect(r.newHoldPreviousStatus).toBe('Warm')
    expect(r.blockedReason).toBeNull()
  })

  it('blocks Hold without hold_until', () => {
    const r = resolveLeadState(state({ status: 'Cold' }), act({ type: 'Hold', hold_reason: 'reason' }), [])
    expect(r.blockedReason).toBeTruthy()
  })

  it('blocks Hold without hold_reason', () => {
    const r = resolveLeadState(state({ status: 'Cold' }), act({ type: 'Hold', hold_until: '2027-01-01' }), [])
    expect(r.blockedReason).toBeTruthy()
  })

  it('blocks Hold with invalid date', () => {
    const r = resolveLeadState(state(), act({ type: 'Hold', hold_until: 'not-a-date', hold_reason: 'reason' }), [])
    expect(r.blockedReason).toBeTruthy()
  })

  it('blocks Hold more than 90 days out', () => {
    const far = new Date()
    far.setDate(far.getDate() + 91)
    const r = resolveLeadState(state(), act({ type: 'Hold', hold_until: far.toISOString().split('T')[0], hold_reason: 'reason' }), [])
    expect(r.blockedReason).toMatch(/90 days/)
  })

  it('Hold lead can still receive activities from Hold state', () => {
    const r = resolveLeadState(
      state({ status: 'Hold', hold_previous_status: 'Warm' }),
      act({ type: 'WhatsApp Received' }),
      [],
    )
    // Should still advance beyond hold previous status
    expect(r.blockedReason).toBeNull()
  })
})

// ─── §7 — resolveLeadState contract invariants ───────────────────────────────

describe('Invariant 1 — terminal block', () => {
  it('blocks Call Made on Closed lead', () => {
    const r = resolveLeadState(state({ status: 'Closed' }), act({ type: 'Call Made', outcome: 'Connected — Positive' }), [])
    expect(r.blockedReason).toBeTruthy()
  })

  it('blocks Site Visit Done on Disqualified lead', () => {
    const r = resolveLeadState(state({ status: 'Disqualified' }), act({ type: 'Site Visit Done' }), [])
    expect(r.blockedReason).toBeTruthy()
  })

  it('allows Note on Closed lead', () => {
    const r = resolveLeadState(state({ status: 'Closed' }), act({ type: 'Note' }), [])
    expect(r.blockedReason).toBeNull()
  })

  it('allows Status Changed on Disqualified lead (owner reopen)', () => {
    const r = resolveLeadState(state({ status: 'Disqualified' }), act({ type: 'Status Changed', reason: 'Lead re-qualified after callback' }), [])
    expect(r.blockedReason).toBeNull()
  })
})

describe('Invariant 2 — milestone idempotency', () => {
  it('blocks a second Site Visit Done', () => {
    const r = resolveLeadState(state({ status: 'Cold' }), act({ type: 'Site Visit Done' }), ['Site Visit Done'])
    expect(r.blockedReason).toContain('already been logged')
  })

  it('blocks a second EOI Received', () => {
    const r = resolveLeadState(state({ status: 'Warm' }), act({ type: 'EOI Received' }), ['EOI Received', 'Site Visit Done'])
    expect(r.blockedReason).toContain('already been logged')
  })

  it('allows a first Site Visit Done (not in existing types)', () => {
    const r = resolveLeadState(state({ status: 'Cold' }), act({ type: 'Site Visit Done' }), ['Call Made', 'WhatsApp Sent'])
    expect(r.blockedReason).toBeNull()
    expect(r.newStatus).toBe('Warm')
  })

  it('blocks a second Deal Closed', () => {
    const r = resolveLeadState(state({ status: 'Hot' }), act({ type: 'Deal Closed' }), ['Deal Closed'])
    expect(r.blockedReason).toContain('already been logged')
  })
})

describe('Invariant 3 — Status Changed requires reason', () => {
  it('blocks Status Changed without reason', () => {
    const r = resolveLeadState(state(), act({ type: 'Status Changed' }), [])
    expect(r.blockedReason).toContain('reason')
  })

  it('blocks Status Changed with empty reason', () => {
    const r = resolveLeadState(state(), act({ type: 'Status Changed', reason: '   ' }), [])
    expect(r.blockedReason).toContain('reason')
  })

  it('allows Status Changed with valid reason', () => {
    const r = resolveLeadState(state(), act({ type: 'Status Changed', reason: 'Customer requested status change' }), [])
    expect(r.blockedReason).toBeNull()
    expect(r.auditNote).toBe('Customer requested status change')
  })
})

describe('Invariant 4 — Hold field validation (see Hold tests above)', () => {
  it('validates hold_until and hold_reason together', () => {
    const r = resolveLeadState(state(), act({ type: 'Hold' }), [])
    expect(r.blockedReason).toBeTruthy()
  })
})

describe('Invariant 5 — NC ≥5 → Disqualified regardless of status', () => {
  it('disqualifies from Hot on 5th NC', () => {
    const r = resolveLeadState(state({ status: 'Hot', failed_contact_attempts: 4 }), act({ type: 'Call Made', outcome: 'No Response' }), [])
    expect(r.newStatus).toBe('Disqualified')
  })

  it('disqualifies from Warm on 5th NC', () => {
    const r = resolveLeadState(state({ status: 'Warm', failed_contact_attempts: 4 }), act({ type: 'Call Made', outcome: 'No Response' }), [])
    expect(r.newStatus).toBe('Disqualified')
  })
})

// ─── Audit trail ─────────────────────────────────────────────────────────────

describe('auditNote', () => {
  it('is null when no status change', () => {
    const r = resolveLeadState(state({ status: 'Hot' }), act({ type: 'Call Made', outcome: 'Connected — Positive' }), [])
    expect(r.auditNote).toBeNull()
  })

  it('is set when status advances', () => {
    const r = resolveLeadState(state({ status: 'New' }), act({ type: 'Call Made', outcome: 'Connected — Positive' }), [])
    expect(r.auditNote).toContain('Cold')
  })

  it('contains disqualify note on 5th NC', () => {
    const r = resolveLeadState(state({ failed_contact_attempts: 4 }), act({ type: 'Call Made', outcome: 'No Response' }), [])
    expect(r.auditNote).toContain('Auto-disqualified')
  })
})

// ─── Out-of-order / edge cases ────────────────────────────────────────────────

describe('Out-of-order and edge cases', () => {
  it('skips intermediate statuses — EOI on New jumps straight to Hot', () => {
    const r = resolveLeadState(state({ status: 'New' }), act({ type: 'EOI Received' }), [])
    expect(r.newStatus).toBe('Hot')
  })

  it('Deal Closed immediately even from New', () => {
    const r = resolveLeadState(state({ status: 'New' }), act({ type: 'Deal Closed' }), [])
    expect(r.newStatus).toBe('Closed')
  })

  it('NC counter does not carry over after disqualify', () => {
    // At 5, it disqualifies and returns the count — no further logic needed
    const r = resolveLeadState(state({ failed_contact_attempts: 4 }), act({ type: 'Call Made', outcome: 'No Response' }), [])
    expect(r.newStatus).toBe('Disqualified')
    expect(r.newFailedAttempts).toBe(5)
  })

  it('WhatsApp Received resets counter AND advances to Cold', () => {
    const r = resolveLeadState(state({ status: 'New', failed_contact_attempts: 3 }), act({ type: 'WhatsApp Received' }), [])
    expect(r.newStatus).toBe('Cold')
    expect(r.newFailedAttempts).toBe(0)
  })

  it('Call Missed advances to Cold even with No Response outcome', () => {
    const r = resolveLeadState(state({ status: 'New' }), act({ type: 'Call Missed', outcome: 'No Response' }), [])
    expect(r.newStatus).toBe('Cold')
    expect(r.newFailedAttempts).toBe(1)
  })

  it('Hold lead resumes from cold when activity arrives', () => {
    const r = resolveLeadState(
      state({ status: 'Hold', hold_previous_status: 'Cold' }),
      act({ type: 'WhatsApp Received' }),
      [],
    )
    // WhatsApp received on hold/cold effective — no advance beyond Cold
    expect(r.blockedReason).toBeNull()
  })

  it('unknown activity type does not change status', () => {
    const r = resolveLeadState(state({ status: 'Cold' }), act({ type: 'Escalated' }), [])
    expect(r.newStatus).toBeNull()
    expect(r.blockedReason).toBeNull()
  })
})
