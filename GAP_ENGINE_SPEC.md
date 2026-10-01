# LeadGap CRM — Gap Engine Specification

Version 1.0 — authoritative. Where existing code disagrees, the code is wrong.

---

## §1 — The Core Idea

A **gap** is the silence between a lead's last meaningful contact and right now,
measured against what is expected at that stage of the pipeline.

A rep with 200 leads cannot decide whom to call. The gap engine makes that
decision. It computes two numbers per lead — `gap_days` and `rescue_priority` —
and uses them to build the Today view: the rep's single daily workspace.

---

## §2 — `gap_days`

`gap_days` = days since the last **qualifying contact** for this lead's stage.

**Qualifying contact by stage:**

| Stage | What counts as contact |
|---|---|
| New | Nothing — New leads have no gap; they are Fresh |
| Cold | Call Made (positive/neutral), WhatsApp Sent, WhatsApp Received, Email Sent, Email Received |
| Warm | Same as Cold, plus Site Visit Scheduled |
| Hot | Same as Warm, plus Site Visit Done |
| Hold | gap_days frozen at 0 — lead is intentionally paused |
| Disqualified / Closed | gap_days irrelevant — excluded from Today view |

**Formula:**

```
gap_days = floor( (now - last_qualifying_contact_at) / 86400 )
```

If no qualifying contact exists: `gap_days = floor( (now - lead.created_at) / 86400 )`

`gap_days` is stored on the `leads` table and recomputed by the nightly job.
It is also recomputed immediately after any activity write (sync, in the same
request) so the Today view is never stale by more than the current request.

---

## §3 — `rescue_priority`

`rescue_priority` determines the sort order within the Slipping list. Higher =
call this person first.

**Formula:**

```
rescue_priority =
    (stage_weight × 40)
  + (gap_urgency  × 35)
  + (intent_score × 0.25)
```

**stage_weight** (0.0–1.0):

| Stage | Weight |
|---|---|
| Hot | 1.0 |
| Warm | 0.7 |
| Cold | 0.4 |
| New | 0.1 |

**gap_urgency** (0.0–1.0):

```
gap_urgency = min(1.0, gap_days / stage_gap_threshold)
```

**stage_gap_threshold** — the number of days after which a lead at this stage
is considered fully overdue:

| Stage | Threshold |
|---|---|
| Hot | 2 days |
| Warm | 4 days |
| Cold | 7 days |
| New | 1 day |

At `gap_days = threshold`, urgency = 1.0 (fully overdue). Past threshold, it
stays capped at 1.0.

**Example:** A Hot lead last contacted 3 days ago:
```
stage_weight = 1.0
gap_urgency  = min(1.0, 3/2) = 1.0
intent_score = 75
rescue_priority = (1.0×40) + (1.0×35) + (75×0.25) = 93.75
```

`rescue_priority` is stored on `leads` and recomputed nightly + after each
activity write.

---

## §4 — Today View

The Today view is the rep's opening screen. It has exactly three sections.
No other sections exist on this page.

### Section 1 — Slipping (capped at 12)

Leads whose `gap_days >= 1` AND `gap_days >= stage_gap_threshold × 0.5`.
Sorted by `rescue_priority` descending. Hard cap of 12 items.

Why 12: a rep can genuinely action 12 rescue calls in a day. More than that
creates anxiety, not action.

Each card shows:
- Lead name, stage badge, intent score
- **Reason line** — plain language (see §6)
- Two action buttons: primary action for the stage, secondary "Log Note"

### Section 2 — Due Today

Leads where `follow_up_date = today`. Sorted by intent_score descending.
No cap — if a rep scheduled 20 follow-ups for today, they should see all of them.

Each card shows:
- Lead name, stage badge
- The note from when the follow-up was set ("Calling to discuss site visit
  availability")
- Time since set, if overdue

### Section 3 — Fresh

New leads (`status = New`) created in the last 48 hours with zero contact
attempts. Sorted by created_at descending. Cap of 8.

Each card shows:
- Lead name, source portal badge, intent score
- "First contact pending" reason line
- One action button: Call or WhatsApp, based on intent score

---

## §5 — Reason Line Rules

Every Slipping card has a single plain-English reason line. These are generated
deterministically — no AI required for the common cases.

Rules applied in order (first match wins):

| Condition | Reason line |
|---|---|
| `status = Hot` AND `gap_days >= 1` | "Hot lead — {gap_days} day{s} since last contact" |
| `status = Warm` AND last activity was `Site Visit Done` AND `gap_days >= 1` | "Site visit done {gap_days} day{s} ago — push for EOI" |
| `status = Warm` AND `gap_days >= 3` | "Warm lead going cold — {gap_days} days of silence" |
| `failed_contact_attempts >= 3` | "Called {N} times with no answer — try WhatsApp now" |
| `failed_contact_attempts >= 1` AND last activity was `Call Missed` | "Missed your last call — send a WhatsApp to reopen" |
| `status = Cold` AND last activity was `WhatsApp Sent` AND `gap_days >= 5` | "Sent a message {gap_days} days ago — no reply yet" |
| `decay_flagged = true` | "High-intent lead going dark — {gap_days} days no contact" |
| default | "{gap_days} day{s} since last touchpoint" |

`{s}` = "s" if value > 1, else "".

---

## §6 — Post-Call Sheet

After logging a call, the rep sees a compact bottom sheet (not a full-screen
modal) with:

1. **Outcome chips** — single select, tap to choose:
   - Connected — Positive
   - Connected — Neutral
   - Connected — Not Interested
   - No Answer
   - Wrong Number

2. **Quick note** — single-line text, optional. Pre-filled with the stage's
   suggested prompt (e.g., "What did they say about the site visit?").

3. **Next action** — optional. Two options: "Set follow-up" (date picker) or
   "Snooze" (tomorrow / 3 days / 1 week).

Tapping any outcome chip immediately writes the activity into the state machine.
The sheet dismisses. Total interaction: under 10 seconds.

The post-call sheet fires directly into `resolveLeadState()` — same transaction
as §8 of `LIFECYCLE_SPEC.md`.

---

## §7 — Weekly Leak Report

Sent every Monday at 8:00 AM IST to the workspace owner.

Content:

```
Subject: Your pipeline last week — {N} leads need attention

Hot leads with no contact (7+ days): [list, max 5]
Leads that went cold last week:       [list, max 5]
NC-disqualified last week:            [count]
Deals closed last week:               [count]

Reply to this email to reopen any lead.
```

Sent via Resend. Template stored in `/emails/weekly-leak.tsx`.

---

## §8 — Voice Note → Activity

A rep records a voice note on the lead detail page.

Flow:
1. Audio recorded in-browser (MediaRecorder API, max 2 min).
2. Uploaded to Supabase Storage.
3. `POST /api/ai/voice-note` sends audio to Whisper (or Claude with audio input)
   for transcription.
4. Claude extracts structured fields: activity type, outcome, notes, next action.
5. Rep sees a confirmation screen with the extracted fields pre-filled.
6. Rep taps Confirm → writes to state machine exactly as a manual log would.

Step 6 is identical to a typed activity log — the extraction just pre-fills the
form. The rep always confirms before anything is written.

---

## §9 — Nightly Job — Gap Recompute

Runs as part of the nightly cron (see `LIFECYCLE_SPEC.md` §9).

For every non-terminal lead:

```
1. Fetch last qualifying contact timestamp (per §2)
2. Compute gap_days
3. Compute rescue_priority
4. Set decay_flagged = true if status=Hot AND gap_days >= 7
5. Write gap_days, rescue_priority, decay_flagged to leads table
```

Total expected runtime for 5,000 leads: under 30 seconds if batched in
chunks of 100 with a single UPDATE per chunk.

---

## §10 — Fields Required on `leads` Table

These columns must exist before Phase 3 ships:

| Column | Type | Default |
|---|---|---|
| `gap_days` | integer | 0 |
| `rescue_priority` | numeric | 0 |
| `decay_flagged` | boolean | false |
| `follow_up_date` | date | null |
| `hold_until` | date | null |
| `hold_reason` | text | null |
| `hold_previous_status` | text | null |
| `last_contact_at` | timestamptz | null |

`last_contact_at` is maintained by the activity write handler — updated whenever
a qualifying contact activity is logged. The nightly job also recalculates it
from the full activity history to self-heal any drift.
