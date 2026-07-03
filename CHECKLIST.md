# RealEdge CRM — Development Checklist
**Rule:** Build → Test → Git commit → Move to next. No skipping. No redoing.  
**Sizes:** S = <4h · M = <2 days · L = <1 week  
**Test standard:** Every item must pass its test criteria before the checkbox is ticked.

---

## PHASE 0 — Foundation
> Goal: Clean slate. New design system, navigation, and Twenty.com wired up.  
> Timeline: Week 1–2 · Must complete before any feature work.

### 0.1 Twenty.com Setup
- [ ] **[S]** Sign up for Twenty Cloud (30-day trial at twenty.com)
  - Test: Can log into Twenty workspace admin panel
- [ ] **[M]** Define all custom objects in Twenty workspace
  - Objects: Contact, Deal, Activity, Property, SiteVisit, PortalLead
  - Fields per object: see PRD Section 5.1
  - Test: All objects visible in Twenty admin → Settings → Objects
- [ ] **[M]** Migrate existing Supabase leads to Twenty via CSV import
  - Export from Supabase → map columns → import to Twenty Contact object
  - Test: All existing leads visible in Twenty with correct fields
- [ ] **[S]** Store Twenty API credentials in `.env.local`
  - `TWENTY_API_URL`, `TWENTY_API_KEY`
  - Test: `curl` to Twenty GraphQL endpoint returns 200

### 0.2 Design System
- [ ] **[M]** Create `/lib/design-tokens.ts` — export all color, spacing, radius, shadow constants
  - All tokens from PRD Section 6 (BG, PANEL, BORDER, accent colors, typography scale)
  - Test: Import in any component, tokens resolve correctly in TS
- [ ] **[S]** Update `globals.css` — CSS variables mapped from design tokens, dark base, Inter font via Google Fonts or next/font
  - Test: Body background is #080D18, font is Inter in browser
- [ ] **[S]** Audit and clean existing Tailwind usage — remove any colors/styles that conflict with new system
  - Test: No leftover hardcoded hex values in old components

### 0.3 Navigation Shell
- [ ] **[L]** Build new `components/layout/Sidebar.tsx`
  - Collapsible: 220px expanded ↔ 56px icon-only
  - Nav items: Dashboard, Leads, Deals, Properties, Outreach, Calls, Analytics, Calculators, Settings
  - Active state highlight, hover states
  - Collapse toggle button (bottom of sidebar)
  - Test: All nav items render, collapse works, active route highlights correctly
- [ ] **[M]** Build `components/layout/TopBar.tsx`
  - Left: page title (dynamic)
  - Right: Search placeholder (⌘K), Quick Add button (+), Notifications bell (0 badge for now), Agent avatar
  - Test: Renders correctly on all dashboard pages
- [ ] **[M]** Update `app/dashboard/layout.tsx` — replace existing layout with Sidebar + TopBar shell
  - Test: All existing dashboard routes still load inside new shell
- [ ] **[S]** Mobile responsive: sidebar collapses to bottom tab bar on <768px
  - Tabs: Home, Leads, Deals, More
  - Test: On mobile viewport, sidebar is hidden, bottom tabs appear

### 0.4 API Proxy Layer
- [ ] **[M]** Build `app/api/crm/` proxy routes that talk to Twenty GraphQL
  - `GET /api/crm/leads` — fetch contacts with filters
  - `POST /api/crm/leads` — create contact
  - `GET /api/crm/leads/[id]` — single contact with all activities
  - `PATCH /api/crm/leads/[id]` — update contact
  - `POST /api/crm/leads/[id]/activities` — log activity
  - Test: Postman/curl each route → correct Twenty response returned
- [ ] **[S]** Auth middleware on all `/api/crm/*` routes — verify Supabase JWT before proxying
  - Test: Request without auth token returns 401

### Git checkpoint: `git commit -m "feat: Phase 0 — design system, new nav shell, Twenty API proxy"`

---

## PHASE 1 — Core CRM
> Goal: Leads flow in automatically, agents manage them in a beautiful UI, every touchpoint is logged.  
> Timeline: Weeks 3–6

### 1.1 Leads List Page (Rebuild)
- [ ] **[L]** Rebuild `app/dashboard/leads/page.tsx` on new design system + Twenty API
  - Table view: Name, Phone, Source, Score badge, Status, Last activity, Assigned agent, Actions
  - Score badge: color-coded (Hot 🔴 ≥70, Warm 🟡 40-69, Cold ⬜ <40)
  - Filters: Status (hot/warm/cold), Source portal, Date added, Assigned agent
  - Search: real-time filter by name/phone/email
  - Sort: by score, by date, by last activity
  - Test: 50 leads load in <500ms, filters work, search narrows results correctly
- [ ] **[M]** Rebuild Kanban view (already exists — wire to Twenty API, keep new design)
  - Columns: New → Contacted → Qualified → Visit Scheduled → Visit Done → Negotiation → Won/Lost
  - Drag-and-drop updates deal stage in Twenty via API
  - Test: Drag card to new column → status updates in Twenty → persists on refresh
- [ ] **[S]** View toggle: List ↔ Kanban (persist preference in localStorage)
  - Test: Toggle switches views, preference persists after page reload

### 1.2 Contact 360 View
- [ ] **[L]** Build `app/dashboard/leads/[id]/page.tsx` — full contact page
  - Left panel (40%): Contact details, editable inline (name, phone, email, budget, timeline, locations, property type)
  - Right panel (60%): Activity timeline (chronological, newest on top)
  - Activity types in timeline: call (with duration + outcome), WhatsApp, email, note, status change, lead created
  - Test: All fields editable, changes save to Twenty on blur, timeline shows all activities
- [ ] **[M]** Quick action bar on contact page
  - Buttons: Call, WhatsApp, Email, Log Note, Schedule Follow-up
  - Each opens a small slide-over panel (not full modal)
  - Test: Each action opens correct panel, submits activity to Twenty API
- [ ] **[M]** Lead score breakdown panel on contact page
  - Shows score (0–100), progress ring, score factors with points
  - "What would improve this score" suggestions
  - Test: Score matches scoring algorithm, suggestions are relevant

### 1.3 Add / Edit Lead
- [ ] **[M]** Rebuild `components/AddLeadModal.tsx` on new design system
  - Fields: name, phone, email, source, property type (multi-select), cities (multi-select), budget range (INR slider), timeline, notes
  - Duplicate detection: check phone on blur → show warning if match found
  - Submits to `/api/crm/leads` → Twenty
  - Test: Lead created in Twenty, appears in list, duplicate warning fires on matching phone
- [ ] **[S]** Quick-add from TopBar (+) button — opens same modal
  - Test: + button opens modal from any dashboard page

### 1.4 Lead Ingestion — Portal Webhooks
- [ ] **[M]** Build `app/api/ingest/magicbricks/route.ts`
  - Accept POST with MagicBricks lead payload
  - Normalize: extract name, phone, email, property type, budget, location
  - Deduplicate by phone → create or update in Twenty
  - Log to PortalLead object in Twenty
  - Test: POST sample MagicBricks payload → lead appears in Twenty with correct fields
- [ ] **[M]** Build `app/api/ingest/99acres/route.ts` — same pattern as above
  - Test: POST sample 99acres payload → lead created correctly
- [ ] **[M]** Build `app/api/ingest/housing/route.ts` — same pattern
  - Test: POST sample Housing.com payload → lead created correctly
- [ ] **[S]** Webhook signature validation on all ingest routes (verify request is from portal, not spoofed)
  - Test: Request with invalid signature returns 401
- [ ] **[S]** Deduplication logic — shared util `lib/dedup.ts`
  - Normalize phone: strip +91, spaces, dashes → 10-digit
  - Test: +91 98765 43210 and 9876543210 treated as same lead
- [ ] **[M]** Email forwarding ingest: `app/api/ingest/email/route.ts`
  - Accept forwarded email body (plain text or HTML)
  - Use Claude claude-haiku-4-5-20251001 to extract: name, phone, email, property type, budget, location
  - Same dedup + create flow
  - Test: Paste sample NoBroker email body → lead extracted and created correctly

### 1.5 Ingestion Log UI
- [ ] **[M]** Build `app/dashboard/leads/ingestion/page.tsx`
  - Table: Source, Raw payload preview, Status (created/duplicate/failed), Contact linked, Timestamp
  - Filter by status and source
  - Click row → see full raw payload
  - Test: After webhook fires, entry appears in log within 2s

### 1.6 WhatsApp Integration (Interakt)
- [ ] **[S]** Sign up for Interakt, get API key, add to `.env.local`
- [ ] **[M]** Build `app/api/whatsapp/send/route.ts`
  - POST `{ to, template_name, variables }` → Interakt API
  - Log sent message as Activity in Twenty
  - Test: Send test message to own number via API, message received, logged in Twenty
- [ ] **[M]** WhatsApp send button on Contact 360 page
  - Opens slide-over: template picker + variable fill-in preview
  - Templates: Welcome, Follow-up Day 1, Follow-up Day 3, Property Recommendation, Site Visit Reminder
  - Test: Select template → preview renders → send → message received + logged
- [ ] **[M]** WhatsApp delivery webhook: `app/api/whatsapp/webhook/route.ts`
  - Interakt fires webhook on message delivered / read / replied
  - Update activity in Twenty with delivery status
  - If reply received: create new Activity (type: whatsapp_reply) with message content
  - Test: Send message, check delivery status updates in timeline within 30s

### 1.7 In-App Notifications
- [ ] **[M]** Build `components/layout/NotificationCenter.tsx`
  - Slide-over panel from bell icon in TopBar
  - Notification types: new lead assigned, follow-up due, hot lead 24h inactive, portal error
  - Mark as read (individual + mark all read)
  - Unread count badge on bell
  - Test: Create test notification via API → appears in panel with badge
- [ ] **[M]** Follow-up reminder system
  - When logging a call/note/WhatsApp: option to "Set follow-up" with date+time picker
  - Store as Activity (type: reminder, scheduled_at: datetime)
  - Cron job (Vercel cron): every 15 min → query overdue reminders → push notification
  - Test: Set reminder 2 min in future → notification appears at correct time
- [ ] **[S]** Daily morning digest (8 AM)
  - Vercel cron: query each agent's due follow-ups, new leads, site visits for today
  - Create summary notification
  - Test: Trigger manually → notification generated with correct counts

### 1.8 Analytics Page (Rebuild on Twenty Data)
- [ ] **[L]** Rebuild `app/dashboard/analytics/page.tsx` consuming `/api/crm/leads` + activities
  - Keep existing charts (they work) — update data source from Supabase to Twenty API proxy
  - Add: Source portal breakdown chart (which portal → most leads, best conversion)
  - Add: Agent response time histogram
  - Test: Charts render with real Twenty data, no mock data fallback in prod
- [ ] **[S]** Date range filter (7d / 30d / 90d / custom) — already exists, wire to Twenty API
  - Test: Switching date range re-fetches and updates all charts

### Git checkpoint: `git commit -m "feat: Phase 1 — core CRM, lead ingestion, WhatsApp, notifications"`

---

## PHASE 2 — Engagement Layer
> Goal: Agents never manually follow up. Every lead is touched on time, every time.  
> Timeline: Weeks 7–12

### 2.1 Click-to-Call (Exotel)
- [ ] **[S]** Sign up for Exotel, get API key + caller ID, add to `.env.local`
- [ ] **[M]** Build `app/api/calls/initiate/route.ts`
  - POST `{ agent_phone, lead_phone, lead_id }` → Exotel Click-to-Call API
  - Returns call SID
  - Test: API call bridges real call between two numbers
- [ ] **[M]** Call button on Contact 360 page and in leads list
  - Click → confirmation slide-over (shows number, "Start call" button)
  - On confirm → POST to `/api/calls/initiate`
  - Call timer overlay appears while call is live
  - Test: Click call → both phones ring → call connects
- [ ] **[M]** Post-call logging slide-over
  - Auto-opens when call ends (via Exotel webhook)
  - Fields: Outcome (Answered/No answer/Busy/Wrong number), Notes, Next action + date
  - Auto-fills: duration (from Exotel webhook), timestamp
  - Saves as Activity (type: call) in Twenty
  - Test: Complete call → logging panel opens → submit → activity appears in timeline
- [ ] **[M]** Exotel webhook: `app/api/calls/webhook/route.ts`
  - Receives call events: initiated, answered, completed
  - On completed: update activity with duration, recording URL
  - Test: Webhook fires from Exotel → activity updated in Twenty within 5s
- [ ] **[M]** Call log page: `app/dashboard/calls/page.tsx`
  - All calls: agent, lead name, duration, outcome, date, recording player
  - Filter by date, agent, outcome
  - Test: All logged calls appear, recording playback works

### 2.2 Outreach Sequences
- [ ] **[L]** Build `app/dashboard/outreach/sequences/page.tsx` — sequence list
  - Create / edit / delete sequences
  - Each sequence: name, trigger (on lead created / manual / on status change), steps[]
  - Test: Create sequence → visible in list → edit works
- [ ] **[L]** Sequence step builder
  - Step types: Wait (X days), Send WhatsApp (template), Send Email (template), Create reminder
  - Drag-to-reorder steps
  - Preview: "Day 0 → WhatsApp Welcome, Day 1 → Email, Day 3 → WhatsApp Follow-up, Day 7 → Call reminder"
  - Test: Build 3-step sequence → save → steps persist in correct order
- [ ] **[M]** Enroll lead in sequence (from Contact 360 page or bulk from leads list)
  - "Enroll in sequence" button → picker → confirm
  - Test: Enroll lead → Day 0 step fires immediately → Day 1 step scheduled
- [ ] **[M]** Sequence execution engine (Vercel cron, every hour)
  - Query: enrolled leads with step due now
  - Execute step (send WhatsApp/email via existing APIs)
  - Log execution as Activity in Twenty
  - Smart stop: if lead replies or status changes to Qualified → pause sequence
  - Test: Enroll lead → wait for step timing → message sent automatically → logged in timeline
- [ ] **[M]** Sequence analytics: sent, delivered, replied, conversion per sequence
  - Test: After sequence runs → stats update correctly

### 2.3 Bulk WhatsApp Broadcast
- [ ] **[M]** Build broadcast flow in `app/dashboard/outreach/whatsapp/page.tsx`
  - Step 1: Filter leads (by status, city, property type, source, score range)
  - Step 2: Preview filtered count ("Sending to 47 leads")
  - Step 3: Pick template + fill variables
  - Step 4: Confirm → fire broadcast
  - Test: Select 5 test leads → broadcast → all 5 receive message → all logged in Twenty
- [ ] **[S]** Broadcast history table: date, template, count sent, delivered %, replied %
  - Test: After broadcast → entry appears with correct stats

### 2.4 AI Features (Expand)
- [ ] **[M]** AI Follow-up Writer: `app/api/ai/follow-up/route.ts`
  - Input: lead context (name, last activity, property interest, budget, notes)
  - Output: ready-to-send WhatsApp message + email subject + body
  - On Contact 360 page: "Write follow-up" button → AI generates → agent edits → sends
  - Test: Provide lead context → AI output is relevant and personalized (not generic)
- [ ] **[M]** AI Property Matcher: `app/api/ai/match-properties/route.ts`
  - Input: lead's requirements (type, city, budget, timeline)
  - Query Twenty Property object for matches
  - Score each property: 0–100 match score with reasons
  - Return top 5 matches
  - On Contact 360 page: "Match properties" panel shows results with one-click share via WhatsApp
  - Test: Lead with 2BHK, Pune, ₹80L budget → top matches are 2BHK Pune properties in that budget
- [ ] **[M]** Refine AI Advisor (already exists)
  - Replace mock data with real Twenty data
  - Add: "Sequence recommendation" — suggest which outreach sequence to enroll this lead in
  - Test: AI Advisor shows real lead data, recommendations are actionable

### 2.5 Property Listings Module
- [ ] **[L]** Build `app/dashboard/properties/page.tsx` — property inventory list
  - Cards: property photo, title, type, city, price (INR), status badge, bedroom/bathroom count
  - Filter: by type, city, price range, status
  - Test: Add 3 test properties → all appear with correct details
- [ ] **[M]** Build `app/dashboard/properties/[id]/page.tsx` — property detail
  - All fields, photo gallery, linked deals, interested leads
  - Test: Navigate to property → all fields correct, linked leads shown
- [ ] **[M]** Add/edit property form (modal or page)
  - Fields: title, type, city, locality, area sqft, price, BHK, floor, possession date, RERA number, images
  - Image upload to Supabase Storage
  - Test: Create property → appears in list → images upload and display correctly
- [ ] **[S]** Link property to lead (on Contact 360 page): "Properties shown" section
  - Add property from search → saves as Activity (type: property_shown) in Twenty
  - Test: Link property to lead → appears in lead's timeline

### 2.6 Stamp Duty Calculator (new)
- [ ] **[M]** Add stamp duty + registration calculator to `app/dashboard/calculators/page.tsx`
  - State selector: Maharashtra, Karnataka, Delhi, Telangana, Tamil Nadu (most common)
  - Input: property value
  - Output: stamp duty %, registration fee, total cost, breakdown
  - Hardcode current state-wise rates (update manually when rates change)
  - Test: ₹1 crore property in Maharashtra → correct stamp duty (6% = ₹6L) + registration (1% = ₹1L)
- [ ] **[S]** Home loan eligibility calculator
  - Inputs: monthly income, existing EMIs, preferred tenure (10/15/20/25/30 yr), rate (editable, default 8.5%)
  - Output: max eligible loan amount, EMI at that amount
  - Test: ₹1L income, no existing EMIs → eligibility is approximately ₹75-80L

### 2.7 Billing / Subscription (Razorpay)
- [ ] **[M]** Razorpay integration: create subscription plans in Razorpay dashboard (Solo, Pro, Team)
- [ ] **[M]** Build `app/dashboard/settings/billing/page.tsx`
  - Current plan display, usage meters (leads this month, WhatsApp sent, call minutes)
  - Upgrade/downgrade buttons → Razorpay Checkout
  - Invoice history
  - Test: Click upgrade → Razorpay modal opens → complete payment → plan updates
- [ ] **[M]** Razorpay webhook: `app/api/billing/webhook/route.ts`
  - Handle: subscription.activated, subscription.charged, subscription.cancelled
  - Update agent's plan in Supabase on each event
  - Test: Simulate webhook events → agent plan updates correctly
- [ ] **[S]** Plan enforcement middleware
  - Check agent's active plan on each API request
  - Return 402 with upgrade prompt if they hit plan limit (e.g., 300 lead limit on Solo)
  - Test: Solo plan agent hitting 301st lead → 402 with correct message

### Git checkpoint: `git commit -m "feat: Phase 2 — calling, sequences, WhatsApp broadcast, AI expand, billing"`

---

## PHASE 3 — Team & Scale
> Goal: Brokerages can use this. Managers have visibility. Everything runs at scale.  
> Timeline: Months 4–6

### 3.1 Team Dashboard
- [ ] **[L]** Build `app/dashboard/team/page.tsx` — manager view (visible only if role = manager/admin)
  - Leaderboard: agents ranked by deals closed / calls made / leads worked this month
  - Per-agent cards: leads assigned, pipeline value, calls today, last activity timestamp
  - Team pipeline: aggregate Kanban across all agents
  - Test: Create 2 agent accounts → manager sees both in team view with correct stats

### 3.2 Lead Routing Rules
- [ ] **[M]** Build `app/dashboard/settings/routing/page.tsx`
  - Rules engine: IF source = MagicBricks AND city = Pune → assign to Agent A
  - Rule priority ordering (drag to reorder)
  - Fallback: round-robin if no rule matches
  - Test: Set rule → new lead from MagicBricks Pune → auto-assigned to correct agent

### 3.3 Power Dialer
- [ ] **[L]** Build `app/dashboard/calls/dialer/page.tsx`
  - Select lead list (filtered cold/warm leads)
  - Queue view: ordered list of leads to call
  - Auto-advance: after post-call log is submitted → next call initiates
  - Skip / snooze (24h) per lead
  - Session summary: X calls made, Y connected, Z follow-ups set
  - Test: Start session with 5 leads → calls fire in sequence → all logged correctly

### 3.4 AI Call Summary (Phase 3)
- [ ] **[L]** Post-call AI transcription
  - Fetch call recording URL from Exotel after call ends
  - Send audio to OpenAI Whisper API → transcript
  - Send transcript to Claude claude-haiku-4-5-20251001 → structured summary (what discussed, agreed, next action)
  - Display in activity timeline under the call entry
  - Test: Complete 2-min call → summary appears in timeline with correct key points within 60s

### 3.5 Move Twenty to Self-Hosted (Before First Team Customer)
- [ ] **[M]** Provision DigitalOcean BLR Droplet (4GB RAM, 2 vCPU, 80GB SSD) — ~$24/month
- [ ] **[M]** Docker Compose: Twenty server + worker + PostgreSQL 15 + Redis 7
- [ ] **[S]** Configure: SERVER_URL, PG_DATABASE_URL, ENCRYPTION_KEY, backups to Supabase Storage (daily)
- [ ] **[M]** Data migration: export from Twenty Cloud → import to self-hosted
- [ ] **[S]** Update `.env.local` TWENTY_API_URL to point to self-hosted instance
- [ ] **[S]** Verify: all API proxy routes work against self-hosted
  - Test: Full E2E flow — ingest lead via webhook → appears in UI → log activity → shows in timeline
- [ ] **[S]** Set up daily backup cron (pg_dump → Supabase Storage)
  - Test: Backup file appears in Supabase Storage within 24h

### 3.6 Custom Report Builder
- [ ] **[L]** Build `app/dashboard/analytics/reports/page.tsx`
  - Group by: agent / city / property type / source / stage
  - Date range: custom picker
  - Metrics: leads, deals, conversion rate, pipeline value, calls, WhatsApps
  - Export: CSV, PDF
  - Test: Build report grouped by city → correct counts per city → CSV exports all rows

### Git checkpoint: `git commit -m "feat: Phase 3 — team dashboard, routing, power dialer, self-hosted Twenty"`

---

## ONGOING — Every Feature, Every Phase

### Code Quality (non-negotiable)
- [ ] No TypeScript `any` types except where Twenty API response types are unknown (use `unknown` + type guards)
- [ ] All API routes return consistent `{ data, error }` shape
- [ ] All user-facing errors show a human-readable message (no raw API errors surfaced)
- [ ] No console.log left in production code (use a logger util)

### Testing Gates
- [ ] Each page: test on Chrome desktop, Safari desktop, Chrome mobile (375px)
- [ ] Each API route: test happy path + missing auth + invalid payload
- [ ] Each form: test empty submit, required field validation, duplicate detection
- [ ] After every phase: do a full E2E run — new lead in → portal webhook → assign → call → WhatsApp → deal won

### Git Discipline
- Commit after every completed checklist item (not before)
- Commit message format: `feat: [item description]` / `fix: [bug]` / `refactor: [what]`
- Never commit broken code — if a feature is half-done, stash it
- PR to main only when the phase is complete and E2E tested

### Performance Checkpoints
- [ ] Leads list: <500ms load at 200 records
- [ ] Contact 360: <800ms load with full activity history
- [ ] Lighthouse score on dashboard: Performance >85, Accessibility >90
- [ ] No unhandled loading states — every async operation has a skeleton or spinner

---

## QUICK REFERENCE — What's Already Built (Don't Rebuild)

| Feature | File | Status |
|---------|------|--------|
| Lead scoring algorithm | `lib/scoring.ts`, `lib/intentScoring.ts` | Keep, wire to Twenty |
| Kanban board | `components/crm/KanbanBoard.tsx` | Keep, update data source |
| Add lead modal | `components/AddLeadModal.tsx` | Rebuild on new design system |
| CSV upload | `components/crm/CsvUploadModal.tsx` | Keep, update to POST to Twenty |
| Email parser modal | `components/crm/EmailParserModal.tsx` | Merge into `/api/ingest/email` route |
| AI Advisor | `components/AIAdvisor.tsx` | Keep, update data source |
| Log activity modal | `components/LogActivityModal.tsx` | Keep, wire to `/api/crm/leads/[id]/activities` |
| Analytics charts | `app/dashboard/analytics/page.tsx` | Keep chart components, update data source |
| Calculators (4) | `app/dashboard/calculators/page.tsx` | Keep, add 2 new calculators |
| Auth (login/signup) | `app/login`, `app/signup` | Keep as-is |

---

*Last updated: 2026-06-28 · Next review: after Phase 1 complete*
