# RealEdge CRM — Complete Product Walkthrough
> Co-founder demo reference · Last updated July 2026

---

## What is RealEdge CRM?

RealEdge is a **real estate-first CRM built for Indian brokers and agencies**. It replaces a combination of WhatsApp, spreadsheets, and generic CRMs (Salesforce, HubSpot) with a single workspace purpose-built for property sales.

**Target users:** Individual agents, small teams (2–20 agents), and mid-size brokerages operating in Tier-1 and Tier-2 Indian cities.

**Core value prop:** Leads from all portals (MagicBricks, 99acres, Housing.com, Facebook Ads) land automatically in one place. Agents call, send WhatsApp follow-ups, track deals in a visual pipeline, and managers see the full team leaderboard — all without switching tools.

---

## Feature Map

| Section | Feature | Status |
|---|---|---|
| Workspace | Lead Management | ✅ Live |
| Workspace | Ingestion Log | ✅ Live |
| Workspace | Deals Pipeline (Kanban) | ✅ Live |
| Workspace | Properties | ✅ Live |
| Workspace | Team Dashboard + Leaderboard | ✅ Live |
| Engage | WhatsApp Sequences | ✅ Live |
| Engage | WhatsApp Broadcast | ✅ Live |
| Engage | Power Dialer | ✅ Live |
| Ingest | Multi-Portal Webhooks | ✅ Live |
| Ingest | Facebook Lead Ads | ✅ Live |
| Ingest | CSV Upload | ✅ Live |
| Ingest | Email Parsing (AI) | ✅ Live |
| Insights | Analytics Dashboard | ✅ Live |
| Insights | EMI / ROI Calculators | ✅ Live |
| Insights | Custom Report Builder | ✅ Live |
| Settings | Lead Routing Rules | ✅ Live |
| Settings | Billing & Subscription | ✅ Live |
| Settings | AI Lead Scoring | ✅ Live |

---

## Feature Details

---

### 1. Lead Management
**Page:** `/dashboard/leads`

Central lead database synced with Twenty.com (open-source CRM backend). Each lead has:
- Name, Phone, Email
- City, Property Interest (BHK type, budget range)
- Lead Score (0–100, AI-generated)
- Source Portal
- Stage: New → Contacted → Qualified → Negotiation → Closed

**Key actions:**
- Click a lead to open the **Lead Detail** panel (right drawer)
- Call via Power Dialer with one click
- Send WhatsApp message directly from the detail panel
- Edit lead details inline
- Bulk actions: select multiple → change stage, assign agent

**Lead Score:** Computed by an AI model based on budget match, response recency, property specificity, and engagement. Displayed as a color-coded badge (red < 40, amber 40–70, green > 70).

---

### 2. Ingestion Log
**Page:** `/dashboard/leads/ingestion`

Audit trail of every lead that came in through any portal or webhook. Shows:
- Source portal
- Contact name + phone
- Status: `created` (new lead), `duplicate` (phone already exists), `failed` (parse error)
- Raw timestamp

**Use case:** Diagnose if a portal webhook is broken, or why a specific lead wasn't created.

---

### 3. Multi-Portal Lead Ingestion
**APIs:** `/api/ingest/magicbricks`, `/api/ingest/99acres`, `/api/ingest/housing`, `/api/ingest/facebook`

Leads flow in automatically from portals. Two mechanisms:

#### How it works (Webhook):
1. You give the portal your webhook URL: `https://yourapp.vercel.app/api/ingest/magicbricks`
2. Portal sends a POST request every time a lead comes in
3. RealEdge normalizes the payload (name, phone, city, property type), de-duplicates by phone, creates the contact in Twenty.com, and logs the ingestion

#### Facebook Lead Ads (Meta Webhooks):
- Dedicated endpoint: `/api/ingest/facebook`
- GET: Meta hub verification
- POST: HMAC SHA256 signature check → fetch lead from Graph API → normalize → ingest
- Requires: `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`

#### Email Parsing (no webhook API required):
- Forward portal notification emails to `/api/ingest/email`
- Claude AI extracts name, phone, city, property interest from the email body
- Works immediately for any portal that sends email notifications
- Requires: `ANTHROPIC_API_KEY`

#### CSV Upload:
- Upload any portal's lead export CSV from the Leads page
- Column mapping: any variation of name/phone/city/type is auto-detected
- Status: All rows get ingested immediately

---

### 4. Deals Pipeline (Kanban)
**Page:** `/dashboard/deals`

Visual Kanban board tracking every deal from first interest to close.

**6 stages:**
| Stage | Meaning |
|---|---|
| New | Deal created, initial contact made |
| Site Visit | Prospect visited the property |
| Negotiation | Price discussion in progress |
| Token Paid | Booking amount received |
| Won | Deal closed, commission booked |
| Lost | Deal dropped |

**Stats bar:** Pipeline Value · Active Deals · Win Rate · Avg Deal Size

**Deal card shows:**
- Lead name + phone
- Property name, locality, city
- Deal value (in ₹Cr / ₹L format)
- Source portal
- Assigned agent
- Expected close date
- Move left/right buttons for quick stage changes

**Deal Modal (click any card):**
- Edit all fields
- Set `Lost Reason` when marking as lost
- Delete deal (with confirmation)

**API:** `GET/POST /api/deals`, `PATCH/DELETE /api/deals/[id]`

---

### 5. Team Dashboard & Leaderboard
**Page:** `/dashboard/team`

**Two tabs:**

#### Team Members tab:
- Add/edit agents with: Name, Email, Phone, Role (agent / senior\_agent / manager)
- Specialty cities and property types (multi-select toggle)
- Monthly target (number of deals)
- Active/inactive toggle

#### Leaderboard tab:
- Ranked by: Deals Won · Win Rate · Pipeline Value
- Each agent row shows: deals won, site visits done, total pipeline, win %
- Ranking badge (1st, 2nd, 3rd with gold/silver/bronze colors)

**How leaderboard is calculated:** Joins deals table by `assigned_to` matching agent name (case-insensitive). No separate logging needed — agents just add deals.

---

### 6. Lead Routing Rules
**Page:** `/dashboard/settings/routing`

Automatically assign new inbound leads to the right agent based on rules.

**Rule types:**
| Rule Type | Example |
|---|---|
| City | Mumbai leads → Rahul Sharma |
| Portal | Facebook Ads leads → Vikram Singh |
| Property Type | Villa leads → Neha Gupta |
| Round Robin | Remaining leads → rotate across team |

**How it works:**
- Rules are evaluated in priority order (1 = highest)
- First matching rule wins
- If no rule matches, lead is unassigned

**To set up:** Go to Lead Routing → click Add Rule → pick type, match value, agent.

---

### 7. WhatsApp Sequences
**Page:** `/dashboard/outreach/sequences`

Automated multi-step WhatsApp follow-up campaigns via Interakt.

**How to create a sequence:**
1. Click New Sequence → name it
2. Add steps: each step is a WhatsApp message with a delay (hours/days after previous step)
3. Enroll leads: select leads from the Leads page → assign sequence

**Message variables:** `{{lead_name}}`, `{{agent_name}}`, `{{property_type}}`, `{{city}}`

**Tracking:** Each step shows sent / delivered / read count.

**API:** `/api/sequences`, `/api/sequences/[id]`
**Requires:** `INTERAKT_API_KEY`

---

### 8. WhatsApp Broadcast
**Page:** `/dashboard/outreach/broadcast`

One-time mass WhatsApp message to a filtered set of leads.

**Filters:** City, source portal, lead stage, property type
**Result:** Filtered leads count shown before sending
**Delivery:** Sent via Interakt's bulk send API

**Use case:** Send a project launch announcement to all "Interested in 3BHK" leads in Mumbai.

**Requires:** `INTERAKT_API_KEY`

---

### 9. Power Dialer
**Page:** `/dashboard/calls`

Sequential calling tool that queues leads by score and lets agents log outcomes without switching tabs.

**How it works:**
1. Queue is auto-populated with your top 50 leads (sorted by AI score, desc)
2. Click "Start Call" → Exotel initiates the call to the lead's phone from your ExoPhone
3. Live call timer runs in the app
4. After the call ends, agent logs outcome: Answered / Voicemail / Not Interested / Callback
5. App auto-advances to next lead in queue

**Call log panel:** Today's completed calls with outcome and duration
**Upcoming queue:** Next 10 leads with score badges

**Simulation mode:** When Exotel is not configured, calls are simulated (amber banner appears). Useful for demos.

**Requires:** `EXOTEL_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_PHONE`

---

### 10. Analytics Dashboard
**Page:** `/dashboard/analytics`

Pre-built charts refreshed from live Supabase data:

- **Lead Volume Trend** — leads received per day/week over last 30 days
- **Source Mix Pie** — MagicBricks vs 99acres vs Housing vs Facebook vs Referral
- **Stage Funnel** — leads at each CRM stage
- **City Heatmap** — top 10 cities by lead volume
- **AI Score Distribution** — histogram of lead quality
- **Response Rate** — contacted vs not contacted

---

### 11. Custom Report Builder
**Page:** `/dashboard/reports`

Build, run, and save custom analytics reports.

**Three tabs:**

#### Templates (8 pre-built)
| Template | Source | Metric |
|---|---|---|
| Pipeline by Stage | Deals | Count |
| Revenue by City | Deals | Total ₹ Value |
| Lead Source Mix | Leads | Count |
| Agent Leaderboard | Deals | Count |
| Monthly Deal Trend | Deals | Count (line) |
| Property Type Mix | Deals | Count (pie) |
| Portal Deal Value | Deals | ₹ Value |
| Win Rate by Agent | Deals | Win % |

Click any template → runs instantly → jumps to Builder with results.

#### Builder (custom)
1. **Data Source:** Deals Pipeline OR Inbound Leads
2. **Group By:** Stage, City, Agent, Portal, Property Type, Month
3. **Metric:** Count, Total ₹ Value, Avg Deal Size, Win Rate %
4. **Chart Type:** Bar, Pie, Line, Table
5. **Filters:** Date range, City, Agent, Portal
6. Click **Run Report** → see chart + data table below
7. **CSV Download** button
8. **Save** — give it a name → appears in Saved tab

#### Saved Reports
- Load any previously saved report with one click
- Delete reports you no longer need

---

### 12. Calculators
**Page:** `/dashboard/calculators`

Financial tools for agents to use with clients during site visits:

- **EMI Calculator** — loan amount, rate, tenure → monthly EMI breakdown
- **ROI Calculator** — purchase price, rental yield, holding period → IRR
- **Stamp Duty Calculator** — state-wise stamp duty + registration charges
- **Affordability Calculator** — income → max loan eligibility

**Share feature:** Each calculator result generates a shareable link to send to the client.

---

### 13. Billing & Subscription
**Page:** `/dashboard/settings/billing`

Razorpay-powered subscription management.

**Plans:**
| Plan | Price | Target |
|---|---|---|
| Starter | ₹799/month | Solo agents |
| Pro | ₹1,999/month | Small teams (up to 5 agents) |
| Team | ₹4,999/month | Agencies (up to 20 agents) |

**Trial:** 14 days free, no credit card required.

**How it works:**
1. User clicks Subscribe → Razorpay checkout opens
2. On payment success, Razorpay sends webhook to `/api/billing/webhook`
3. Subscription record created in `subscriptions` Supabase table
4. Feature gates check subscription status

**Requires:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, plan IDs

---

## Portal Lead Ingestion — How It Works

This is the most common question from new users. Here's the clear answer:

### You do NOT need API keys from portals (for webhooks)

The portals POST to your URL. You just need a publicly deployed app URL.

**Setup per portal:**

| Portal | Where to configure | Notes |
|---|---|---|
| **MagicBricks** | Partner Dashboard → CRM Integration → Webhook URL | Need MagicBricks partner account |
| **99acres** | My Account → API Integration → Endpoint URL | Need 99acres broker login |
| **Housing.com** | Broker Dashboard → Settings → Lead Delivery → Webhook | Same |
| **Facebook Lead Ads** | Meta for Developers → Webhooks → Subscribe to `leadgen` | Need Meta App + Page Access Token |

**Your webhook URLs:**
```
MagicBricks:  https://yourapp.vercel.app/api/ingest/magicbricks
99acres:      https://yourapp.vercel.app/api/ingest/99acres
Housing.com:  https://yourapp.vercel.app/api/ingest/housing
Facebook:     https://yourapp.vercel.app/api/ingest/facebook
```

### Fastest way to start (no portal API partnership needed)

1. **Email forwarding** — All portals send you a "New Lead" email. Set up email forwarding from that email → trigger `/api/ingest/email`. Claude parses the email and creates the lead. Works today.

2. **CSV upload** — Export leads from portal dashboard → upload on the Leads page. Instant.

3. **Zapier/n8n** — Connect portal's Zapier app → POST to your webhook. No partnership approval needed.

### For production (recommended after launch)

Apply as a tech/CRM partner with each portal:
- MagicBricks partner program: partners.magicbricks.com
- 99acres tech partners: typically via email to partners@99acres.com
- Housing.com: via your account manager

Approval takes 1–4 weeks. Once approved, they whitelist your webhook URL and leads flow automatically.

---

## Demo Walkthrough Script (for co-founder pitch)

**Time: ~15 minutes**

1. **Open Dashboard** → show the overview stats (deals in pipeline, leads today, team activity)
2. **Leads page** → show lead list, click a lead → detail panel → score badge, call button, WhatsApp button
3. **Ingestion Log** → show MagicBricks / 99acres entries coming in automatically
4. **Deals → Kanban** → drag a card from Negotiation → Token Paid → show stats update
5. **Team → Leaderboard** → show agents ranked by deals won
6. **Power Dialer** → click Start Queue → show call timer (simulated if Exotel not set)
7. **Reports → Templates** → click "Pipeline by Stage" → bar chart populates instantly
8. **Reports → Builder** → set Revenue by City → Run → switch to line chart
9. **Calculators** → run EMI calc → share link
10. **Lead Routing** → show rules (Mumbai → Rahul, Facebook → Vikram)
11. **Billing** → show plans (₹799 Starter, ₹1,999 Pro, ₹4,999 Team)

**Key pitch points:**
- "Every portal, one inbox" — leads from MagicBricks, 99acres, Housing, Facebook all land here automatically
- "No spreadsheets" — Kanban deals pipeline with ₹Cr values, win rates tracked automatically
- "AI does the prioritisation" — lead score tells agents who to call first
- "Built for India" — ₹Cr/₹L formatting, Exotel calling, Interakt WhatsApp, Razorpay billing
- "₹799/month vs ₹500 competitor" — but with a full AI stack, not just a lead inbox

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router, inline styles, Recharts 3.5 |
| Auth | Supabase Auth |
| Database | Supabase (PostgreSQL) — deals, team, routing, billing, sequences |
| CRM Backend | Twenty.com (open-source) — contacts/leads |
| AI | Claude claude-sonnet-4-6 — lead scoring, email parsing |
| Calling | Exotel (click-to-call) |
| WhatsApp | Interakt API |
| Payments | Razorpay Subscriptions |
| Portal Ingest | Custom webhooks per portal |
| Hosting | Vercel (frontend + API routes) |
| Self-host option | Twenty.com on Railway/Render |

---

## Pending / Roadmap

- [ ] AI call summaries (Whisper transcription → Claude summary)  
- [ ] Mobile app (React Native)  
- [ ] Builder listing sync (direct MLS/project DB feed)  
- [ ] WhatsApp chatbot for lead qualification  
- [ ] Invoice generation + stamp duty receipts  
- [ ] Multi-workspace / white-label for franchises  
