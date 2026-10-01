# LeadGap CRM — Lifecycle Specification

Version 1.0 — authoritative. Where existing code disagrees, the code is wrong.

---

## §1 — Purpose

This document defines the complete lead lifecycle: every status, every valid
transition, every activity that drives a transition, and every rule the system
applies automatically. Nothing in the lifecycle may be changed without updating
this document first.

---

## §2 — Statuses

| Status | Meaning | Terminal? |
|---|---|---|
| **New** | Lead arrived; zero contact attempts logged | No |
| **Cold** | Contact attempted; requirements not yet confirmed | No |
| **Warm** | Requirements confirmed (budget + location + intent verified in at least one call) | No |
| **Hot** | EOI / booking interest expressed; near close | No |
| **Closed** | Deal done; booking or registration complete | Yes |
| **Disqualified** | 5 consecutive NC attempts, or owner override with mandatory reason | Yes |
| **Hold** | Rep-set pause with a `hold_until` date and mandatory reason | No — resumes automatically |

**Rules:**
- The rep **never selects a status manually**. The system derives it from activities.
- An owner (admin role) may override to any non-terminal status with a mandatory
  free-text reason, logged as a `Status Changed` activity.
- Re-opening a `Closed` or `Disqualified` lead requires owner override + reason.
- `Hold` is the only status a rep may set directly; they must supply a reason and
  a `hold_until` date (max 90 days out).

---

## §3 — Transitions

```
         ┌────────────────────────────────────────────────────┐
         │                                                    │
New ──→ Cold ──→ Warm ──→ Hot ──→ Closed (terminal)          │
  ↘      ↓        ↓        ↓                                 │
   \  Disqualified (terminal — any stage, via NC ≥ 5 or      │
    \              owner override)                           │
     \                                                       │
      → Hold (any non-terminal stage → Hold → back to same   │
              stage when hold_until passes)                  │
        ─────────────────────────────────────────────────────┘
```

**Forward-only rule:** Status may only advance, never regress — except via
Hold (which preserves stage) or owner override (which is audited).

---

## §4 — Activity → State Table

Every activity is logged as-is. The state machine reads the activity type and
outcome to decide whether a transition fires.

| Activity | Outcome required | Status transition | Notes |
|---|---|---|---|
| Call Made | any positive or neutral | New → Cold | First successful contact |
| Call Made | No Response | increment NC counter | See §5 |
| Call Missed | — | New → Cold | Counts as a contact attempt |
| WhatsApp Sent | — | New → Cold | First outbound message |
| WhatsApp Received | — | New → Cold | Inbound reply, immediate advance |
| Email Sent | — | New → Cold | |
| Email Received | — | New → Cold | Inbound reply |
| VM Done | — | Cold → Warm (minimum) | Video meeting milestone |
| OBM Done | — | Cold → Warm (minimum) | On-site builder meeting milestone |
| Site Visit Scheduled | — | no transition | Flags intent but doesn't qualify |
| Site Visit Done | — | Cold → Warm (minimum) | Post-visit = requirements confirmed |
| EOI Received | — | Warm → Hot (minimum) | Locks in serious intent |
| Deal Closed | — | any → Closed | Terminal |
| Follow Up Set | — | no transition | Sets `follow_up_date` on lead |
| Note | — | no transition | Internal record only |
| Status Changed | — | owner override, any | Must have `reason` in activity_data |

**"Minimum" means:** if the lead is already past that status, it stays there.
Forward-only is enforced.

---

## §5 — NC (No Contact) Tracking

NC = a `Call Made` or `Call Missed` with `outcome = 'No Response'`.

- Each NC increments `failed_contact_attempts` on the lead.
- At `failed_contact_attempts >= 5`: system automatically transitions to
  `Disqualified`, logs a `Status Changed` activity with reason
  `"Auto-disqualified: 5 consecutive no-contact attempts"`.
- A positive or neutral outcome on any call **resets** `failed_contact_attempts`
  to zero.
- WhatsApp Received also resets the counter (lead is reachable).

---

## §6 — Hold Logic

When a rep sets Hold:
- `status` = `Hold`
- `hold_previous_status` stores the status being suspended
- `hold_until` = the date the hold expires (required, max 90 days)
- `hold_reason` = free-text reason (required)

Nightly job checks all `Hold` leads:
- If `hold_until < today`: restore `status = hold_previous_status`, clear
  hold fields, log `Status Changed` activity with reason `"Hold expired"`.

A rep may cancel Hold early. That also restores the previous status.

---

## §7 — `resolveLeadState()` — Contract

This function is the single source of truth for all status transitions. It is
**pure** — no DB calls inside it. The caller fetches the data; this function
computes the outcome.

```ts
type LeadState = {
  status:                string
  failed_contact_attempts: number
  hold_previous_status?: string
  hold_until?:           string
}

type ActivityInput = {
  type:    string
  outcome?: string
  reason?:  string
  hold_until?: string
  hold_reason?: string
}

type StateResolution = {
  newStatus:             string | null   // null = no change
  newFailedAttempts:     number | null   // null = no change
  newHoldPreviousStatus: string | null
  blockedReason:         string | null   // non-null = reject the write
  auditNote:             string | null   // what to log in activity_data
}

function resolveLeadState(
  current: LeadState,
  activity: ActivityInput,
  existingActivityTypes: string[],
): StateResolution
```

**Invariants the function must enforce:**
1. Terminal statuses (Closed, Disqualified) block all activity-driven transitions.
2. Milestones (VM Done, OBM Done, Site Visit Done, EOI Received, Deal Closed)
   may only be logged once per lead.
3. Hold requires `hold_until` and `hold_reason`; missing either → blocked.
4. Owner Status Changed requires `reason`; missing → blocked.
5. NC at ≥5 → Disqualified, regardless of current status (except terminals).

---

## §8 — One Transaction Per Activity Write

The activity POST handler must execute these steps **atomically** (or as a
sequential chain that rolls back on failure):

1. Call `resolveLeadState()` with current state + incoming activity.
2. If `blockedReason` is set: return 409, do not write anything.
3. Insert row into `lead_activities`.
4. Apply `newStatus`, `newFailedAttempts` to `leads` in the same transaction.
5. Write audit trail: if `newStatus` differs from current, log a `Status Changed`
   activity with `auditNote` as the reason.
6. If `type = 'Follow Up Set'`: set `follow_up_date` on the lead, schedule
   notification for 9 AM on that day.
7. Call `recalcLeadScore()` (async, fire-and-forget — may not be in the same TX).

---

## §9 — Nightly Job Responsibilities

Runs at 02:00 IST. Idempotent — safe to re-run.

1. **NC promotion:** any `Hold`-expired leads → restore previous status.
2. **Score recompute:** call `recalcLeadScore()` for all non-terminal leads
   with activity in the last 30 days.
3. **Gap recompute:** recalculate `gap_days` and `rescue_priority` for all
   active leads (see `GAP_ENGINE_SPEC.md`).
4. **Hot decay flag:** Hot leads with no contact in 7+ days get
   `decay_flagged = true` (used by Today view).
5. **Hold expiry:** as described in §6.

---

## §10 — Status Dropdown Removal

The status field on the lead card is **read-only** for reps. It is a derived
display, not an input. The only exception is Hold — reps may set a lead to Hold
from the lead detail page action bar.

Admins see an "Override Status" option that opens a modal requiring a reason.

---

## §11 — Naming Conventions

Existing code uses some inconsistent names. The canonical names are:

| Canonical | Old variants to replace |
|---|---|
| `New` | `Fresh` (in status context) |
| `Cold` | `Contacted` |
| `Warm` | `Qualified` |
| `Hot` | `Negotiation` |
| `Disqualified` | `DNC`, `Dead` |
| `failed_contact_attempts` | `failedContactAttempts`, `nc_count` |
| `follow_up_date` | `nextActionDate`, `followUpDate` |
| `hold_until` | `holdUntil`, `pauseUntil` |

---

## §12 — Activity Types (Canonical List)

```
Call Made
Call Missed
WhatsApp Sent
WhatsApp Received
Email Sent
Email Received
VM Done
OBM Done
Site Visit Scheduled
Site Visit Done
EOI Received
Deal Closed
Follow Up Set
Note
Status Changed
Escalated
Escalation Removed
```

No other activity types may be created without updating this list.
