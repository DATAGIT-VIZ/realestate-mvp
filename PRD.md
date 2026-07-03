i read # Product Requirements Document
## RealEdge CRM — AI-Powered Real Estate CRM SaaS for India

**Version:** 1.0  
**Date:** 2026-06-25  
**Status:** Living Document — update as decisions are made  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Target Users & Personas](#3-target-users--personas)
4. [Product Goals & Success Metrics](#4-product-goals--success-metrics)
5. [Feature Requirements](#5-feature-requirements)
   - 5.1 CRM Core (Twenty.com)
   - 5.2 Lead Ingestion Pipeline
   - 5.3 Lead Management & Scoring
   - 5.4 Cold Calling
   - 5.5 WhatsApp & Email Outreach
   - 5.6 Analytics & Reporting
   - 5.7 AI Features
   - 5.8 Property Calculators
   - 5.9 Notifications & Reminders
   - 5.10 Property Listings Module
6. [UI/UX Design Direction](#6-uiux-design-direction)
7. [Technical Architecture](#7-technical-architecture)
8. [Integration Map](#8-integration-map)
9. [Business Model & Pricing](#9-business-model--pricing)
10. [Phased Roadmap](#10-phased-roadmap)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Out of Scope (for now)](#12-out-of-scope-for-now)
13. [Open Questions & Decisions Log](#13-open-questions--decisions-log)

---

## 1. Executive Summary

**RealEdge CRM** is an AI-powered, India-first real estate CRM SaaS platform designed for independent real estate agents, brokers, and small-to-mid-sized real estate firms. It consolidates lead capture from all major Indian property portals (MagicBricks, 99acres, Housing.com, NoBroker), automates follow-up across WhatsApp, email, and phone, and gives agents a Salesforce-level CRM experience without the Salesforce price tag or complexity.

The CRM backbone is powered by **Twenty.com** (self-hosted, open-source), with a completely custom-built Next.js frontend that delivers a premium, subtle, AI-native interface — think Linear or Attio, not old-school enterprise software.

**Core philosophy:** Every feature must make an agent more productive in less time. The UI must feel fast, clean, and effortless.

---

## 2. Problem Statement

### The Indian Real Estate Agent Today

A typical real estate agent in India manages:
- Leads coming in from 4–6 different portals simultaneously (MagicBricks, 99acres, Housing.com, their own website, Facebook Ads, Google Ads)
- Follow-ups tracked in WhatsApp, Excel sheets, or basic notes apps
- No unified view of where each lead stands in the pipeline
- Manual dialing with no call logging or recording
- Zero automation — every follow-up is remembered (or forgotten)
- No analytics to understand which portal brings the best leads

**The result:** Agents lose 30–40% of warm leads simply due to follow-up failure. The best deal-making agents are not the most knowledgeable — they are the most organized.

### What's missing in the market

Existing solutions for Indian real estate:
- **International CRMs (Salesforce, HubSpot):** Expensive, complex, not built for Indian portals, no WhatsApp-first workflow
- **Indian CRMs (LeadSquared, Kylas):** Functional but clunky UIs, no AI, no portal-native integration
- **Portal-native tools (MagicBricks CRM):** Siloed — only works within one portal, no cross-portal view

**The gap:** A fast, beautiful, AI-powered CRM that speaks Indian real estate natively — portal integrations, INR, Indian cities, WhatsApp-first, and affordable for independent agents.

---

## 3. Target Users & Personas

### Persona 1 — Independent Agent "Ravi"
- **Role:** Self-employed real estate agent, 3–8 years experience
- **Team size:** Solo or 2–3 people
- **Volume:** 50–200 active leads at any time
- **Portals:** MagicBricks + 99acres + Facebook Ads
- **Pain:** Leads pile up, forgets to follow up, tracks everything in WhatsApp
- **Goal:** Close 4–6 deals per month, not miss a single hot lead
- **Willingness to pay:** ₹2,000–5,000/month if the product saves time and closes deals
- **Key feature needs:** Lead inbox, fast follow-up, call from app, WhatsApp integration

### Persona 2 — Small Brokerage "Priya"
- **Role:** Owner of a 5–15 agent brokerage firm
- **Team size:** 5–15 agents
- **Volume:** 500–2000 leads per month across team
- **Portals:** All major portals + developer partnerships
- **Pain:** No visibility into what agents are doing, leads fall through cracks, duplicate work
- **Goal:** Scale the team without chaos, track team performance, route leads to right agents
- **Willingness to pay:** ₹800–1,500/agent/month
- **Key feature needs:** Lead routing/assignment, team analytics, manager dashboard, pipeline visibility

### Persona 3 — Real Estate Developer Sales Team "Arjun"
- **Role:** Sales manager at a mid-size real estate developer
- **Team size:** 10–30 agents + pre-sales
- **Volume:** Massive inbound from project launches — 1000+ leads/month
- **Portals:** Primarily MagicBricks + Housing.com + own website + site visit management
- **Pain:** Lead velocity during launches, site visit scheduling, conversion tracking per project
- **Goal:** Maximize site visits, track project-wise pipeline, manage channel partners
- **Willingness to pay:** Custom/enterprise pricing
- **Key feature needs:** Project-wise pipelines, site visit scheduling, channel partner management

---

## 4. Product Goals & Success Metrics

### Phase 1 Goals (MVP — Months 1–3)
| Goal | Metric | Target |
|------|--------|--------|
| Prove core value | User retention at 30 days | >60% |
| Replace Excel/WhatsApp tracking | Daily active users / total users | >70% |
| Validate lead ingestion | Leads auto-captured from portals | >80% of agent's total leads |
| Validate calling | Calls logged via app | >50% of all calls made |

### Phase 2 Goals (Growth — Months 4–8)
| Goal | Metric | Target |
|------|--------|--------|
| Revenue | MRR | ₹5L/month |
| Scale | Paying agents | 200+ |
| Automation | Leads auto-followed-up within 10 min | >90% |
| Conversion improvement | Agent-reported deal improvement | >25% more deals/month |

### North Star Metric
**Deals closed per agent per month** — everything we build must move this number up.

---

## 5. Feature Requirements

---

### 5.1 CRM Core — Powered by Twenty.com

**Decision:** Twenty.com (self-hosted) is the CRM data layer. The Next.js frontend is custom-built and talks to Twenty's GraphQL API. Users never see or touch Twenty's own UI.

#### Custom Objects to Define in Twenty

| Object | Fields | Notes |
|--------|--------|-------|
| **Contact** (Lead) | name, phone, whatsapp, email, source_portal, source_detail, city, localities[], budget_min, budget_max, property_type[], timeline, intent_score, assigned_agent, status, created_at | Core object |
| **Property** | title, type, city, locality, area_sqft, price, bedrooms, bathrooms, floor, total_floors, possession_date, developer, rera_number, portal_links[], images[], status | Inventory |
| **Deal** | contact, property, stage, deal_value, probability, expected_close, agent, notes | Pipeline |
| **Activity** | type (call/whatsapp/email/visit/note), contact, agent, duration, recording_url, outcome, next_action, next_action_date | Activity log |
| **Site Visit** | contact, property, scheduled_at, agent, outcome, feedback, follow_up_date | Visit tracking |
| **Portal Lead** | raw_payload, source_portal, parsed_contact, ingestion_status, created_at | Raw ingestion log |
| **Agent** (User) | name, email, phone, role, team, portals_connected[], monthly_target | Agent profile |

#### CRM Views Required
- **My Leads** — personal pipeline with filters (hot/warm/cold, by source, by date)
- **Team Leads** — manager view (who owns what, status across team)
- **Deal Pipeline** — Kanban by deal stage
- **Activity Feed** — chronological log of all touchpoints
- **Contact 360 View** — single page per contact: all activities, calls, messages, properties shown

---

### 5.2 Lead Ingestion Pipeline

This is the highest-value feature — agents need zero manual entry for leads coming from portals.

#### Supported Sources (Priority Order)
1. **MagicBricks** — webhook push + email forwarding fallback
2. **99acres** — webhook push + email forwarding fallback
3. **Housing.com** — webhook push + email forwarding fallback
4. **NoBroker** — email forwarding (no webhook)
5. **Facebook Lead Ads** — Meta Webhooks API
6. **Google Ads Lead Forms** — Google Ads API webhooks
7. **Website inquiry form** — native form → API
8. **Manual entry** — CSV upload, single form, email paste

#### Ingestion Flow

```
Portal fires lead (webhook POST or email)
    ↓
/api/ingest/[source] — normalize to standard schema
    ↓
Deduplication check (phone number match against existing contacts)
    ↓
If duplicate → merge activity, update last_seen
If new → create Contact in Twenty via GraphQL mutation
    ↓
Auto-assign to agent (round-robin / by city / by portal rule)
    ↓
Trigger: WhatsApp welcome message (if WhatsApp connected)
    ↓
Create follow-up reminder (15 min from ingestion)
    ↓
Push notification to assigned agent
```

#### Email Forwarding (Fallback for portals without webhooks)
- Each agent gets a unique ingest email address: `leads+[agent_id]@realedge.in`
- Agent forwards portal notification emails to this address
- Parser extracts structured data from email HTML/text using AI (Claude claude-haiku-4-5-20251001)
- Parsed data follows the same ingestion flow above

#### Deduplication Rules
- Primary key: **phone number** (normalized: strip spaces, +91 prefix, country code)
- Secondary: email match
- If matched: do not create duplicate, log new source as additional touchpoint on existing contact
- Show agent: "Lead already exists — last contacted X days ago"

---

### 5.3 Lead Management & Scoring

#### Lead Status States
```
New → Contacted → Qualified → Site Visit Scheduled → Site Visit Done 
→ Negotiation → Deal Won | Deal Lost | Stale
```

#### Intent Scoring Model (0–100)
Computed score based on weighted signals:

| Signal | Weight | Logic |
|--------|--------|-------|
| Contact info completeness | 30 pts | Phone=20, Email=10 |
| Budget specified | 25 pts | Both min+max=25, One=15 |
| Timeline urgency | 25 pts | Immediate=25, <3mo=15, <6mo=5 |
| Source quality | 20 pts | Website/Referral=20, Paid ad=15, Portal=10, Unknown=5 |
| Activity recency bonus | +15 pts | Activity in last 24h = +15, last 72h = +10 |
| Response time bonus | +15 pts | Responded <2h = +15, <24h = +10 |
| Engagement depth | +10 pts | 3+ touchpoints = +10 |
| **Max score** | **100** | Capped at 100 |

#### Score Thresholds
- **Hot (70–100):** Red/orange indicator. Must follow up within 2 hours.
- **Warm (40–69):** Amber indicator. Follow up within 24 hours.
- **Cold (<40):** Grey indicator. Add to nurture sequence.

#### Bulk Actions
- Mass reassign leads to another agent
- Mass update status
- Mass add to outreach sequence
- Export to CSV

---

### 5.4 Cold Calling

**Telephony Provider (India):** Exotel (primary), Twilio (fallback/international)

#### Features

**Click-to-Call**
- Agent clicks phone number anywhere in the app → call bridged via Exotel
- No hardware needed — works on mobile/desktop browser
- Agent's personal mobile rings first, then the lead's number

**During Call**
- Call timer visible in UI
- Quick note-taking panel open alongside
- Select outcome before hanging up: Answered / No answer / Busy / Wrong number / Call back later
- One-click next action scheduling from call outcome

**Post-Call Logging (Auto)**
- Call duration, timestamp, outcome auto-logged to contact's Activity feed in Twenty
- Call recording URL stored (if recording enabled — opt-in per agent)
- Intent score recalculated after call

**Power Dialer (Phase 2)**
- Queue up a list of cold leads
- Auto-dials next contact when current call ends
- Skip / snooze per contact
- Designed for high-volume cold calling sessions

**Call Analytics**
- Calls made per agent per day
- Connect rate (answered / dialed)
- Avg call duration
- Best time of day to call (derived from connect rate data)

---

### 5.5 WhatsApp & Email Outreach

#### WhatsApp (Primary channel — India)

**Provider:** Interakt or AiSensy (WhatsApp Business API resellers, India-native, cheaper than Meta direct)

**Features:**
- Send individual WhatsApp from contact page (one-click, pre-filled templates)
- Template library — pre-approved WhatsApp templates for:
  - Welcome message on lead capture
  - Property recommendation
  - Site visit reminder (24h before, 1h before)
  - Follow-up (Day 1, Day 3, Day 7)
  - Festival/event greetings
  - Price drop alerts
- Bulk WhatsApp broadcast to a filtered segment (e.g., "All warm leads interested in 2BHK in Baner")
- Replies surface in CRM timeline (bidirectional sync via webhook)
- WhatsApp delivery + read receipts visible in activity feed

**Outreach Sequences (Drip)**
- Visual sequence builder: Day 0 → WhatsApp, Day 1 → Email, Day 3 → WhatsApp, Day 7 → Call reminder
- Trigger: On lead creation, on status change, manual enrollment
- Pause sequence if lead responds (smart stop)
- A/B testing on message templates (Phase 2)

#### Email

**Provider:** SendGrid (transactional) / Mailgun fallback

**Features:**
- Send email from contact page with template picker
- Email open tracking + click tracking
- Template library: property brochure, site visit invite, loan eligibility, newsletter
- Bulk email to filtered segments
- Email thread linked to contact timeline

---

### 5.6 Analytics & Reporting

#### Agent-Level Dashboard
- Leads this week/month vs target
- Calls made, WhatsApps sent, emails sent
- Deals in pipeline by stage + total pipeline value (INR)
- Hot leads requiring immediate action
- Conversion funnel: New → Contacted → Qualified → Visit → Deal
- Activity heatmap (which days/times are most productive)

#### Manager/Team Dashboard
- Team leaderboard (deals closed, calls made, leads worked)
- Per-agent pipeline value and conversion rate
- Lead distribution: which agent has how many leads
- Source ROI: which portal is generating the best conversion (not just volume)
- Lead age report: leads stuck in same stage for >7 days (flagged)
- Revenue forecast based on pipeline probability

#### Portal Performance Report
- Leads by source portal (volume + quality score)
- Cost per lead by portal (if ad spend data entered)
- Conversion rate per portal
- Best property types per portal

#### Custom Reports (Phase 2)
- Date range picker
- Group by: agent / city / property type / source / stage
- Export to CSV, PDF

---

### 5.7 AI Features

#### AI Lead Advisor (Already built — refine)
- Surfaces top 5 priority actions for the day
- Explains WHY a lead is ranked high ("Budget confirmed + visited site 3 days ago — follow up now")
- Powered by Claude claude-haiku-4-5-20251001 with full lead context

#### AI Property Matcher
- Given a lead's requirements (city, budget, type, timeline), suggest matching properties from inventory
- Show match score per property
- One-click send property recommendation to lead via WhatsApp

#### AI Follow-up Writer
- Agent describes the context: "Ravi called yesterday, interested in 3BHK, wants to visit this weekend"
- AI generates a ready-to-send WhatsApp message or email
- Agent reviews and sends — no blank-page problem

#### AI Deal Intelligence (Phase 2)
- Predict deal close probability based on activity patterns
- Flag deals going cold ("No activity in 5 days — this deal is at risk")
- Suggest best next action per deal

#### AI Call Summary (Phase 2)
- Transcribe call recording (Whisper API)
- Generate structured summary: what was discussed, what was agreed, next action
- Auto-populate post-call note in CRM

---

### 5.8 Property Calculators

Already built — four calculators. Needs polish and integration into main flow.

**Existing:**
- Buy vs Rent Calculator
- EMI Calculator
- Rental Yield Calculator
- Investment Projection Calculator

**Additions:**
- **Stamp Duty & Registration Calculator** (state-wise — Maharashtra, Karnataka, Delhi, etc.)
- **Home Loan Eligibility Calculator** (based on income, EMI, tenure)
- Shareable calculator links (already built) — add one-click WhatsApp share button
- Embed calculators on agent's external website (iframe embed code — Phase 2)

---

### 5.9 Notifications & Reminders

#### In-App Notification Center
- Bell icon in nav with unread count badge
- Notification types:
  - New lead assigned
  - Follow-up due now
  - Lead went from cold to warm (score change)
  - Site visit in 1 hour
  - Deal stage change by teammate
  - Portal connection error

#### Smart Reminders
- Set follow-up reminder from any call/activity
- System auto-creates reminders: "No activity on hot lead for 24h → alert"
- Daily morning digest: "You have 3 follow-ups due today, 1 site visit, 2 new leads"
- Overdue reminder escalation: 24h overdue → warning, 48h overdue → urgent

#### Push Notifications (Mobile Web)
- PWA push notifications for new lead arrival
- Call reminders (mobile vibration at scheduled call time)

---

### 5.10 Property Listings Module

**Purpose:** Agent manages their own inventory — properties they represent. Links deals to specific listings.

**Features:**
- Add/edit property listing (all fields from Property object in 5.1)
- Upload property photos (stored in Supabase Storage / Cloudflare R2)
- RERA compliance fields
- Property status: Available / Under Offer / Sold
- Link property to Deal (which lead is interested in which property)
- Property shortlist view per lead
- Shareable property microsite (unique URL per property — Phase 2)

---

## 6. UI/UX Design Direction

### Design Philosophy

**Subtle. Fast. Premium.**

The interface must feel like the agent barely notices it — it stays out of the way and surfaces what matters. No decorative clutter. Every pixel earns its place.

**Reference products for aesthetic:**
- **Linear** — speed, keyboard-first, dark elegance
- **Attio CRM** — premium data presentation, clean typography
- **Raycast** — command palette, effortless navigation
- **Notion** — calm neutrals, readable density
- **Vercel Dashboard** — dark mode done right, data-forward

### Design System

**Color Palette**
```
Background:     #080D18   (near-black, deep navy)
Surface:        #0E1623   (elevated panel)
Surface-2:      #141E2E   (card, modal)
Border:         rgba(255,255,255,0.06)
Border-hover:   rgba(255,255,255,0.12)

Accent-Blue:    #3B82F6   (primary actions, links)
Accent-Violet:  #7C3AED   (AI features, highlights)
Amber:          #F59E0B   (warm leads, warnings)
Emerald:        #10B981   (success, deals won)
Red-Hot:        #FB923C   (hot leads, urgent)
Red-Error:      #EF4444   (errors, lost deals)

Text-Primary:   #F1F5F9
Text-Secondary: #94A3B8
Text-Muted:     rgba(255,255,255,0.35)
```

**Typography**
- Font: **Inter** (system-native fallback stack)
- Scale: 11px (micro labels) → 12 → 14 → 16 → 20 → 24 → 32
- Font weights: 400 (body), 500 (label), 600 (heading), 700 (display only)
- No decorative fonts. Clarity over personality.

**Spacing**
- Base unit: 4px
- Component padding: 12px / 16px / 20px
- Section spacing: 24px / 32px
- Dense mode toggle: reduce spacing 20% for power users

**Component Style**
- Rounded corners: 6px (inputs, buttons) / 10px (cards) / 16px (modals)
- Borders: always subtle, never heavy
- Shadows: none on dark bg — use border + bg layering instead
- Icons: Lucide React (already in stack) — 16px default, 20px nav
- Animations: 120–200ms ease-out. No bounces. Nothing that delays work.

### Navigation Structure

```
Left Sidebar (collapsible, 220px → 56px)
├── [Logo / Brand]
├── Dashboard (Home)
├── Leads
│   ├── My Leads
│   ├── Team Leads (manager only)
│   └── Ingestion Log
├── Deals (Pipeline)
├── Properties (Inventory)
├── Outreach
│   ├── Sequences
│   ├── WhatsApp
│   └── Email
├── Calls
│   ├── Call Log
│   └── Power Dialer
├── Analytics
├── Calculators
└── Settings
    ├── Portal Connections
    ├── Team & Agents
    ├── Templates
    ├── Integrations
    └── Billing

Top Bar
├── Global Search (⌘K)
├── Quick Add (+ New Lead, + New Deal, + New Property)
├── Notifications Bell
└── Agent Avatar / Account
```

### Key UX Principles
1. **Command palette (⌘K):** Search leads, navigate, trigger actions from anywhere
2. **Zero loading spinners on main views:** Optimistic UI updates
3. **Keyboard shortcuts throughout:** Power users never need the mouse
4. **Mobile-first for field agents:** Core flows (view lead, log call, send WhatsApp) must work perfectly on mobile
5. **Contextual AI:** AI suggestions surface inline, never in a separate "AI tab"
6. **Density toggle:** Default comfortable view; compact mode for power users managing 200+ leads

---

## 7. Technical Architecture

### Stack Overview

```
Frontend:     Next.js 16 (App Router) — TypeScript
Styling:      Tailwind CSS v4
Icons:        Lucide React
Charts:       Recharts
Auth:         Supabase Auth
CRM Engine:   Twenty.com (self-hosted, Docker)
Database:     PostgreSQL (via Twenty) + Supabase (auth, storage)
Cache:        Redis (via Twenty's Docker stack)
AI:           Anthropic Claude API (claude-haiku-4-5-20251001 for tasks, claude-sonnet-4-6 for advisor)
Telephony:    Exotel (India) / Twilio (international)
WhatsApp:     Interakt or AiSensy (WhatsApp Business API)
Email:        SendGrid
Storage:      Supabase Storage (images, docs) / Cloudflare R2 (backups)
Hosting:      Vercel (Next.js) + VPS/DigitalOcean (Twenty Docker)
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Frontend                   │
│              (Custom UI — Vercel)                    │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────┐   ┌─────────────────────────┐
│  Twenty GraphQL API  │   │     Supabase            │
│  (Self-hosted VPS)   │   │  Auth + Storage         │
│  Port 3000           │   └─────────────────────────┘
│  PostgreSQL + Redis  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│              Next.js API Routes (/api/*)              │
│                                                       │
│  /api/ingest/[source]     Lead ingestion webhook     │
│  /api/calls/[action]      Exotel telephony proxy     │
│  /api/whatsapp/[action]   Interakt WhatsApp proxy    │
│  /api/ai/[action]         Claude AI proxy            │
│  /api/scoring/[leadId]    Intent score recalc        │
└──────────────────────────────────────────────────────┘
           │
           ├──► Exotel API (calling)
           ├──► Interakt API (WhatsApp)
           ├──► SendGrid API (email)
           ├──► Anthropic Claude API (AI)
           └──► Portal Webhooks (MagicBricks, 99acres, etc.)
```

### Data Flow: Lead Ingestion

```
1. Portal fires POST to /api/ingest/magicbricks
2. Validate webhook signature
3. Parse & normalize to standard Contact schema
4. Phone number deduplication query to Twenty GraphQL
5a. Duplicate found → POST activity to existing contact
5b. New lead → POST createContact mutation to Twenty
6. POST createActivity (source: portal, timestamp, raw data)
7. Run intent score calculation
8. PATCH contact with intent_score
9. Trigger assignment rule → PATCH contact.assigned_agent
10. POST to Interakt → send WhatsApp welcome
11. Create follow-up reminder in Twenty
12. Push notification to agent (via Supabase Realtime)
```

### Twenty.com Setup (Self-Hosted)

- Deployed on a dedicated VPS (DigitalOcean Droplet, minimum 4GB RAM)
- Docker Compose: Twenty server + Twenty worker + PostgreSQL + Redis
- Exposed only on internal network; Next.js API routes proxy all requests (no direct browser access to Twenty)
- Environment: `SERVER_URL`, `PG_DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`
- Admin panel accessible at VPS IP for object model configuration
- Backup: daily PostgreSQL dump to Supabase Storage

### API Design

All Twenty interactions go through Next.js API route proxies. Frontend never calls Twenty directly. This:
- Keeps the CRM backend swappable in the future
- Allows server-side validation before mutations
- Hides Twenty credentials from browser

```typescript
// Example: /api/crm/leads
GET  /api/crm/leads?filter=hot&assigned_to=me
POST /api/crm/leads          — create lead
GET  /api/crm/leads/[id]     — full contact 360
PATCH /api/crm/leads/[id]    — update lead
POST /api/crm/leads/[id]/activities — log activity
```

---

## 8. Integration Map

| Integration | Provider | Purpose | Priority |
|-------------|----------|---------|----------|
| MagicBricks | Direct webhook | Lead ingestion | P0 |
| 99acres | Direct webhook | Lead ingestion | P0 |
| Housing.com | Direct webhook | Lead ingestion | P0 |
| NoBroker | Email forward parse | Lead ingestion | P1 |
| Facebook Lead Ads | Meta Webhooks API | Lead ingestion | P1 |
| Google Lead Forms | Google Ads API | Lead ingestion | P2 |
| Exotel | REST API + webhooks | Click-to-call, call logging | P1 |
| Interakt / AiSensy | REST API + webhooks | WhatsApp send/receive | P0 |
| SendGrid | REST API | Email outreach | P1 |
| Anthropic Claude | API | AI advisor, follow-up writer, call summary | P0 |
| Twenty.com | GraphQL API | CRM data layer | P0 |
| Supabase | Auth SDK + REST | Auth, file storage | P0 |
| Cloudflare R2 | S3-compatible API | Property image storage | P2 |
| Razorpay | Checkout SDK | SaaS subscription billing | P1 |

---

## 9. Business Model & Pricing

### Target Market (India)
- ~2.5 million registered real estate agents in India
- Total addressable market: ₹1,250 crore/year (if 5% adopt at ₹2,500/month average)
- Beachhead: Mumbai, Pune, Bengaluru, Hyderabad, Delhi-NCR

### Cost Structure (Per Agent, Monthly)

| Cost Line | Amount | Notes |
|-----------|--------|-------|
| Claude AI API | ₹150 | Haiku for scoring/parsing, Sonnet for advisor |
| WhatsApp (Interakt) | ₹200 | Base + per-message blended |
| Exotel telephony | ₹150 | ~30 calls × 3 min avg × ₹1.5/min |
| SendGrid email | ₹50 | Transactional + outreach |
| Storage (images/docs) | ₹30 | Supabase Storage |
| Razorpay fees | ₹100 | 2% + ₹3/txn on monthly bill |
| Fixed infra share* | ₹100 | VPS + Vercel + Supabase (at 100 agents) |
| Customer support | ₹300 | 1 support person per 100 active agents |
| CAC amortised | ₹350 | ₹4,200 CAC over 12-month LTV horizon |
| **Total fully-loaded cost** | **~₹1,430/agent/month** | Basis for margin calc |

*Fixed infra: VPS ₹2,000 + Vercel ₹1,660 + Supabase ₹2,075 + misc ₹500 = ₹6,235/month total

### Pricing Tiers

| Plan | Monthly | Annual (save 20%) | Gross Margin | Fully-loaded Margin |
|------|---------|-------------------|--------------|---------------------|
| **Solo** | ₹2,999 | ₹28,790/yr | ~76% | ~52% |
| **Pro** | ₹6,499 | ₹62,390/yr | ~82% | ~78% |
| **Team** | ₹4,999/seat (min 3) | ₹47,990/seat/yr | ~80% | ~71% |
| **Enterprise** | ₹1,00,000+/month | Custom | ~75% | ~68% |

> **Target: 55%+ fully-loaded margin at scale (100+ agents). Pro and Team plans exceed this from day one. Solo plan crosses 55% at 50+ total agents when fixed costs dilute.**

### What Each Plan Includes

**Solo — ₹2,999/month**
- 1 agent seat
- 300 leads/month from portals
- 2 portal connections (MagicBricks + 99acres)
- WhatsApp: 200 messages/month
- Calling: 60 min/month via Exotel
- AI Advisor: basic daily summary
- Calculators (all 6)
- Email support

**Pro — ₹6,499/month**
- 1 agent seat
- Unlimited leads, all portal connections
- WhatsApp: unlimited + bulk broadcast + sequences
- Calling: 500 min/month + call recording
- AI Advisor: full + follow-up writer + property matcher
- Outreach sequences (email + WhatsApp drip)
- Priority support (chat)

**Team — ₹4,999/seat/month (min 3 seats, annual billing)**
- Everything in Pro per seat
- Manager dashboard + team leaderboard
- Auto lead routing rules
- Per-agent analytics
- Team WhatsApp number
- Dedicated onboarding call
- SLA: 4-hour support response

**Enterprise — ₹1,00,000+/month**
- Unlimited seats
- Dedicated self-hosted instance (data never shared)
- White-label option (your brand, your domain)
- Custom portal integrations
- API access for internal tools
- Dedicated account manager
- 99.5% uptime SLA

### Revenue Model
- **Primary:** Monthly / annual subscriptions
- **Secondary (Phase 2):** Telephony overage — ₹1.8/min over plan limit (markup on Exotel cost)
- **Secondary (Phase 3):** Co-broking marketplace — 0.5% of deal value for matched deals

### Unit Economics
- Target CAC: ₹4,000–6,000 per agent (primarily digital: Google Ads + real estate community groups)
- Target LTV at Pro: ₹6,499 × 18 months avg = ₹1,16,982
- LTV:CAC ratio target: **20:1 at Pro tier**
- Payback period: <1 month at Pro, <2 months at Solo
- MRR to hit profitability (covering 1 FT dev + 1 support + infra): ~₹3,00,000/month (~46 Pro agents)

### Billing Infrastructure
- Razorpay subscriptions (UPI, cards, net banking, EMI)
- Annual billing discount: 20% (2 months free — improves cash flow)
- Free trial: 14 days, no credit card required
- Failed payment grace: 3 days, then read-only mode (data never deleted)
- Self-serve plan upgrade/downgrade anytime

---

## 10. Phased Roadmap

### Phase 0 — Foundation (Current → Week 2)
- [ ] Sign up for Twenty Cloud (30-day trial)
- [ ] Define all custom objects in Twenty (Contact, Deal, Activity, Property, Site Visit)
- [ ] Migrate existing Supabase lead data to Twenty
- [ ] New design system: tokens, layout, navigation shell
- [ ] Rebuild leads list page with new UI consuming Twenty API

### Phase 1 — Core CRM (Weeks 3–6)
- [ ] Lead ingestion: MagicBricks + 99acres webhooks
- [ ] Email forwarding parser (Claude-powered) for portals without webhooks
- [ ] Contact 360 view (full timeline, activities, properties)
- [ ] Kanban pipeline with Twenty-backed deal stages
- [ ] WhatsApp integration (Interakt) — send from contact page
- [ ] In-app notifications + follow-up reminders
- [ ] Rebuild analytics with Twenty data
- [ ] Mobile-responsive core flows

### Phase 2 — Engagement Layer (Weeks 7–12)
- [ ] Exotel click-to-call + call logging
- [ ] Outreach sequences (visual builder)
- [ ] Bulk WhatsApp broadcast
- [ ] Housing.com + Facebook Lead Ads ingestion
- [ ] AI Property Matcher
- [ ] AI Follow-up Writer
- [ ] Property listings module
- [ ] Stamp Duty calculator (state-wise)
- [ ] Razorpay billing + subscription management

### Phase 3 — Team & Scale (Months 4–6)
- [ ] Team/manager dashboard + leaderboard
- [ ] Lead routing rules (auto-assign by city/portal/agent load)
- [ ] Power Dialer
- [ ] AI Call Summary (Whisper transcription)
- [ ] Custom report builder
- [ ] Agent performance reviews
- [ ] Move Twenty to self-hosted VPS (before first paying team customer)

### Phase 4 — Platform (Months 7–12)
- [ ] Agent public profile + shareable property pages
- [ ] Co-broking marketplace (connect agents on deals)
- [ ] Developer/builder portal (channel partner management)
- [ ] API access for enterprise customers
- [ ] White-label option

---

## 11. Non-Functional Requirements

### Performance
- First Contentful Paint: <1.5s on 4G India mobile
- Lead list load (200 records): <500ms
- Contact 360 view load: <800ms
- All mutations (add lead, log call): <300ms with optimistic UI

### Security
- All API routes authenticated via Supabase JWT
- Twenty API never exposed directly to browser — always proxied
- Phone numbers stored as hashed in any logs (PII protection)
- Role-based access: agent can only see own leads; manager sees team; admin sees all
- Webhook endpoints: signature verification on all portal webhooks
- HTTPS everywhere; no HTTP fallbacks

### Reliability
- Target uptime: 99.5% (for self-hosted Twenty: redundant VPS + daily backups)
- Webhook ingestion: queue-backed, retry on failure (leads cannot be lost)
- Graceful degradation: if Twenty is down, show cached data with "updating" indicator

### Scalability
- Twenty self-hosted: scales vertically to ~50,000 contacts/agent easily
- For >10,000 active agents: move to Twenty on managed PostgreSQL (RDS/Supabase)
- Next.js on Vercel: serverless, scales automatically

### Compliance
- RERA data fields (RERA number, agent license) for regulatory compliance
- Data residency: Indian user data on servers in India (Mumbai region — AWS ap-south-1 / DigitalOcean BLR)
- DPDP Act (India's data protection law) compliance: data deletion on request, consent management

### Accessibility
- Keyboard navigation for all core flows
- WCAG 2.1 AA color contrast ratios
- Screen reader labels on all interactive elements

---

## 12. Out of Scope (for now)

These are explicitly NOT being built in the current phases. Document them to avoid scope creep.

- Native iOS / Android app (PWA covers mobile for now)
- Video calling (use WhatsApp/Google Meet for now)
- Property valuation / AVM (Automated Valuation Model)
- Loan origination / DSA features
- Legal document management / e-signatures
- Post-sales project management (construction updates)
- Customer-facing portal (buyer login)
- Multi-language UI (English only for now)
- Offline mode

---

## 13. Open Questions & Decisions Log

| # | Question | Status | Decision |
|---|----------|--------|----------|
| 1 | Twenty Cloud (trial) → when to move to self-hosted? | Open | Move before first Team plan customer |
| 2 | WhatsApp provider: Interakt vs AiSensy vs Wati? | Open | Evaluate pricing + template approval speed |
| 3 | Telephony: Exotel vs Knowlarity vs Ozonetel? | Open | Exotel preferred — better docs, startup-friendly |
| 4 | Product name: "RealEdge CRM" confirmed? | Open | Placeholder — decide before public launch |
| 5 | Which Indian portals have official webhook support? | Open | Research needed — fallback to email parse |
| 6 | Self-hosting region: DigitalOcean BLR vs AWS Mumbai? | Open | DigitalOcean BLR for cost; AWS if enterprise needed |
| 7 | Free trial: 14 days or 30 days? | Open | 30 days for initial cohort, reduce to 14 post-validation |
| 8 | Mobile: PWA or React Native later? | Open | PWA now; React Native if mobile usage >60% of sessions |

---

*This document is maintained alongside the codebase. Update Section 13 whenever a decision is made. Update Section 10 as phases complete.*

*Last updated: 2026-06-25*
