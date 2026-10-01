# Phase 0 — Open Decisions

Work through these before Phase 1 code starts.

---

## Decision 1 — Who is customer #1?

**Recommended answer:** Solo agent. The 4,000-lead database is theirs.

**Why:** The architecture already assumes this. `agent_id` is on every lead.
Onboarding can be a single screen: "Import your leads." No team routing,
no invite flow needed in v1.

**What changes if it's a team instead:** The onboarding wizard needs an
agent roster step, routing rules must ship in v1, and every screen needs
an "assigned to" filter. This is 3–4 extra weeks.

**Action needed:** Confirm yes/no. If yes (solo), mark resolved.

---

## Decision 2 — Which features are Teams-only?

**Recommended list:**

| Feature | Teams-only? |
|---|---|
| Routing rules (auto-assign leads) | Yes |
| Agent reassignment | Yes |
| Team performance dashboard | Yes |
| Live activity feed (all agents) | Yes |
| Broadcast to multiple agents' leads | Yes |
| ||||
| Sequences | No — solo agents use them too |
| Portal webhooks | No — solo agents set them up |
| Calculator | No |
| AI Advisor | No |

**Action needed:** Review and confirm the list. This gates the billing page and
the feature-lock banners.

---

## Decision 3 — WhatsApp template submission

**Status: Not started. This blocks Phase 4.**

You need 5 approved WABA templates before Phase 4 (WhatsApp two-way) can ship.
Interakt approval takes 3–7 days and can be rejected on first submission.

**Recommended templates to submit now:**

1. **New lead intro**
   > "Hi {{1}}, I'm {{2}}, your property advisor from {{3}}. You enquired about
   > properties in {{4}} — I'd love to help you find the right match. What's a
   > good time to connect today?"

2. **Post-missed-call**
   > "Hi {{1}}, I tried calling you but couldn't reach you. I'm following up on
   > your property enquiry. Please reply with a convenient time to speak, or
   > call me back on {{2}}."

3. **Site visit confirmation**
   > "Hi {{1}}, your site visit for {{2}} is confirmed for {{3}} at {{4}}.
   > Our team will meet you at the main entrance. Please save this number for
   > any queries."

4. **Post-site-visit follow-up**
   > "Hi {{1}}, thank you for visiting {{2}} yesterday. I hope you liked the
   > property. Did you have any questions or would you like to discuss the
   > pricing and payment plan?"

5. **Re-engagement (cold lead)**
   > "Hi {{1}}, we last spoke {{2}} months ago about properties in {{3}}.
   > We have new options that match your requirements. Would you like me to
   > send the details?"

**Action needed:** Log into Interakt, submit these 5 templates for WABA
approval. Do this today — don't wait for Phase 4.

---

## Decision 4 — Demo workspace flagging and wipe

**Recommended answer:**

Add `is_demo = true` on the dev agent row
(`00000000-0000-0000-0000-000000000001`). The wipe endpoint already exists
at `/api/seed/route.ts` — it deletes all leads, activities, and sequences for
the agent.

For live demos alongside real customers: the `DEV_BYPASS_AUTH` env var already
separates the demo workspace from real sessions. No additional mechanism needed
until you have multiple real customers.

**Action needed:** Confirm this is sufficient for now, or describe the demo
scenario that isn't covered.

---

## Decision 5 — What leaves the default view

**From the build plan:** calculators, retention chart, market pulse,
top locations are candidates for removal from the default rep view.

**Recommended answer:**

Keep everything on the dashboard for now — these features are already built and
don't hurt. In Phase 3, after the Today view ships, run it past the first 5
agents. They'll tell you what they never look at. Remove those things then, not
before.

**What definitely moves behind a nav item in Phase 3:**
- Financial calculators → under a "Tools" section
- Market pulse banner → optional, collapses on scroll

**Action needed:** Confirm deferral to Phase 3, or name any feature you want
removed now.
