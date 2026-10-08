// Help & Support content. Every answer was checked against the code on 8 Oct 2026, so update it
// when the feature it describes changes. Text supports **bold**. Each answer's id is its link:
// /dashboard/help#<id>. Answers about Settings assume the new Settings section (components/settings).

import type { Icon } from '@phosphor-icons/react'
import {
  RocketLaunch, Users, Stack, CalendarCheck, PhoneCall, Megaphone, Robot, ChartBar, UsersThree, ShieldCheck,
  UserPlus, ChartLineUp, Kanban, ChatCircleDots,
} from '@phosphor-icons/react'
import type { Tone } from '@/components/outreach/OutreachKit'

export type Block = string | { list: string[] } | { steps: string[] } | { note: string; tone?: 'blue' | 'amber' }
export type Faq = {
  id: string
  q: string
  a: Block[]
  /** Extra words people might search for */
  keywords?: string
  links?: { label: string; href: string }[]
  /** A button that emails support with this subject */
  mail?: { label: string; subject: string; body?: string }
}
export type Topic = { id: string; title: string; blurb: string; Icon: Icon; color: string; faqs: Faq[] }

export const QUICK_LINKS: { label: string; sub: string; href: string; Icon: Icon; tone: Tone }[] = [
  { label: 'Add your first lead', sub: 'Create one, import a CSV or paste a portal email', href: '/dashboard/leads', Icon: UserPlus, tone: 'blue' },
  { label: 'View lead analytics', sub: 'Where leads come from and how they move', href: '/dashboard/analytics', Icon: ChartLineUp, tone: 'violet' },
  { label: 'Start a dialing session', sub: 'Call a list of leads one after another', href: '/dashboard/calls', Icon: PhoneCall, tone: 'green' },
  { label: 'Send a WhatsApp broadcast', sub: 'One message to many leads at once', href: '/dashboard/outreach/broadcast', Icon: ChatCircleDots, tone: 'green' },
  { label: 'Open the Pipeline board', sub: 'Every lead in columns, by stage', href: '/dashboard/lifecycle', Icon: Kanban, tone: 'amber' },
  { label: 'Ask the AI Advisor', sub: 'A script, a message or a next step for any lead', href: '/dashboard/advisor', Icon: Robot, tone: 'blue' },
]

export const POPULAR = ['CS ID', 'NC', 'Import', 'Dialer', 'Invite', 'Export']

/** Shown beside the search box */
export const QUICK_ANSWER_IDS = ['cs-id', 'nc-rule', 'import-csv', 'invite-team']

export const TOPICS: Topic[] = [
  // ─── Getting started ──────────────────────────────────────────────────────────────────────────────
  {
    id: 'start', title: 'Getting started', blurb: 'The first things to set up', Icon: RocketLaunch, color: '#1D4ED8',
    faqs: [
      {
        id: 'first-steps', q: 'What should I set up first?', keywords: 'start begin setup onboarding new account',
        a: [
          'Four things get you working in a day:',
          { steps: [
            '**Bring in your leads.** On **Leads**, use **Create lead** for one, **Import CSV** for a spreadsheet, or **Parse Email** to paste an enquiry email from a portal.',
            '**Open Today each morning.** It lists the follow-ups that are due, new leads nobody has called and leads going quiet.',
            '**Call through the Power Dialer.** Pick a list and LeadGap lines the calls up one after another, saving each outcome as you go.',
            '**On Teams, invite your agents** from **Invite team** in the sidebar, then share leads between them.',
          ] },
        ],
        links: [{ label: 'Leads', href: '/dashboard/leads' }, { label: 'Today', href: '/dashboard/today' }, { label: 'Power Dialer', href: '/dashboard/calls' }],
      },
      {
        id: 'import-csv', q: 'How do I import leads from a spreadsheet?', keywords: 'csv excel upload bulk import template sheet',
        a: [
          { steps: [
            'Go to **Leads** and click **Import CSV**.',
            'Drop in a **.csv** file. Save an Excel sheet as CSV first. Need a starting point? Download the **Template**.',
            'Match your columns. **Client Name** and **Phone** are required. Exports from 99acres, MagicBricks, Housing.com and Facebook Leads are recognised and matched for you.',
            'Check the preview. Rows with problems can be fixed right there. For leads you already have, choose **Skip** (the default) or **Overwrite**.',
            'Import. Every new lead starts at **New** and gets a CS ID.',
          ] },
          'Phone numbers can be 10 digits, or start with 0, 91 or +91. Budgets like 50L, 1Cr or 50-80L are understood.',
          { note: 'Imported a file by mistake? **Import history** lets you undo a whole batch. A **Notes** column isn\'t imported yet.' },
        ],
        links: [{ label: 'Leads', href: '/dashboard/leads' }],
      },
      {
        id: 'portal-leads', q: 'Can leads from MagicBricks, 99acres or Housing.com come in on their own?', keywords: 'portal magicbricks 99acres housing nobroker facebook google webhook automatic sync integration',
        a: [
          'Automatic portal sync isn\'t live yet. Until it is, two ways are quick:',
          { list: [
            '**Parse Email:** on **Leads**, paste the enquiry email a portal sends you. AI pulls out the name, phone and requirement and saves the lead.',
            '**Import CSV:** download your leads from the portal and import the file. Portal exports are recognised automatically.',
          ] },
        ],
        links: [{ label: 'Leads', href: '/dashboard/leads' }],
      },
    ],
  },

  // ─── Leads & CS IDs ───────────────────────────────────────────────────────
  {
    id: 'leads', title: 'Leads & CS IDs', blurb: 'Adding, finding and de-duplicating leads', Icon: Users, color: '#1D4ED8',
    faqs: [
      {
        id: 'cs-id', q: 'What is a CS ID?', keywords: 'id number reference cs00001 find search lead id',
        a: [
          'Every lead gets a CS ID the moment it\'s saved, however it arrives: **CS00001**, **CS00042** and so on. It never changes, so it\'s the easiest way to point a teammate or support to one lead.',
          { list: [
            '**Leads search** and the **top bar search** (Ctrl K or ⌘ K) find a lead by its full CS ID.',
            'The **Pipeline** search box finds part of one too, like "0042".',
            'Copy a CS ID from the Leads list, the lead\'s page or the Power Dialer.',
          ] },
        ],
      },
      {
        id: 'add-lead', q: 'How do I add a lead by hand?', keywords: 'new lead create manual add',
        a: [
          { steps: [
            'Go to **Leads** and click **Create lead**.',
            'Fill in the **first name** and a **10-digit mobile number**. Those two are required; email, budget, client type, source, property type, timeline, city and localities are optional.',
            'Click **Add Lead**. It starts at **New**, gets a CS ID and an intent score straight away.',
          ] },
          'Have an enquiry email from a portal? **Parse Email** on the same page reads it and fills the lead in for you.',
        ],
        links: [{ label: 'Leads', href: '/dashboard/leads' }],
      },
      {
        id: 'duplicates', q: 'What happens if I add a lead twice?', keywords: 'duplicate same phone dedupe double',
        a: [
          'LeadGap checks the phone number:',
          { list: [
            '**Create lead:** if the number is already saved, you see **Duplicate detected** and nothing new is created.',
            '**Import CSV:** the preview marks rows that match a lead you have, or another row in the file. Choose **Skip** to keep what you have or **Overwrite** to replace it with the file.',
            '**Parse Email:** a lead you already have is skipped and counted in the result.',
          ] },
          'On **Leads**, the **possible duplicates** filter shows any two leads that share a number.',
        ],
      },
      {
        id: 'client-type', q: 'What is client type?', keywords: 'individual channel partner agent interior designer',
        a: [
          'Who the lead is: **Individual**, **Channel Partner**, **Agent** or **Interior Designer**. You choose it in **Create lead**.',
          { note: 'Client type is saved with the lead, but it can\'t be changed later or used as a filter yet.', tone: 'amber' },
        ],
      },
    ],
  },

  // ─── Lead stages ──────────────────────────────────────────────────────────
  {
    id: 'stages', title: 'Lead stages', blurb: 'How leads move from New to Closed', Icon: Stack, color: '#B54708',
    faqs: [
      {
        id: 'stages', q: 'What are the lead stages?', keywords: 'lifecycle pipeline new cold warm hot closed disqualified status',
        a: [
          'Every lead is in one stage. The **Pipeline** board shows them as columns:',
          { list: [
            '**New:** not contacted yet',
            '**Cold:** contact attempted',
            '**Warm:** requirements confirmed',
            '**Hot:** EOI received',
            '**Closed:** deal done',
            '**Disqualified:** dropped or unreachable',
          ] },
          'Leads move forward on their own as you log work: a call that isn\'t unanswered, a WhatsApp or an email moves New to **Cold**; a VM, OBM or site visit moves it to **Warm**; an EOI to **Hot**; a closed deal to **Closed**. They never move backwards on their own.',
        ],
        links: [{ label: 'Pipeline', href: '/dashboard/lifecycle' }],
      },
      {
        id: 'move-stage', q: 'How do I change a lead\'s stage myself?', keywords: 'move drag stage change status manually',
        a: [
          { list: [
            'On the **Pipeline** board, drag the card to another column. On a phone, press and hold first.',
            'Or tap the **next stage** button on the card. Changed your mind? Tap **Undo** in the message that pops up.',
            'On a lead\'s page, **Log activity** → **Call Made** has **Move to Stage**, so you can log the call and move the lead in one go.',
          ] },
        ],
        links: [{ label: 'Pipeline', href: '/dashboard/lifecycle' }],
      },
      {
        id: 'nc-rule', q: 'What does NC mean?', keywords: 'nc not contactable no answer no response disqualified 5 calls unreachable',
        a: [
          'NC means **not contactable**. After **5 unanswered calls in a row**, LeadGap moves the lead to **Disqualified**, so your lists stay full of people you can reach.',
          { list: [
            'Pipeline cards show the count, like **3/5**, and the Power Dialer warns you before the fifth call.',
            '**No answer** in the Power Dialer or on Today counts, and so does **Not Connected** in Log activity.',
            'A call that connects, or a WhatsApp reply from the lead, sets the count back to zero. Sending them a message doesn\'t.',
          ] },
          'To bring an NC lead back, drag it to an open stage on the **Pipeline** board. The count isn\'t reset when you do, so the next unanswered call disqualifies it again until a call connects.',
        ],
      },
      {
        id: 'board-search', q: 'How do I find one lead on the Pipeline board?', keywords: 'search board pipeline find filter lifecycle',
        a: [
          'Use the search box above the board. Type a name, part of a CS ID, or 4 or more digits of a phone number, and every column filters as you type. When only one card matches, it\'s outlined in blue. Clear the search with **✕**.',
          'Next to it, **Show** narrows the board to open leads, leads not contacted, leads gone quiet, or won and lost. **Filter** narrows it by source or intent, and **Sort** changes the order.',
        ],
        links: [{ label: 'Pipeline', href: '/dashboard/lifecycle' }],
      },
    ],
  },

  // ─── Today ────────────────────────────────────────────────────────────────
  {
    id: 'today', title: 'Today & follow-ups', blurb: 'Your list for the day', Icon: CalendarCheck, color: '#067647',
    faqs: [
      {
        id: 'today-page', q: 'What shows up on Today?', keywords: 'today follow up due overdue quiet daily list morning',
        a: [
          'Today is the list of what to do now, in three parts:',
          { list: [
            '**Follow-ups due:** tasks due today, plus any that are overdue.',
            '**New leads:** the 10 newest leads nobody has called yet.',
            '**Going quiet:** leads with no update for a while. Hot after **1 day**, Warm after **2 days**, Cold after **4 days**.',
          ] },
          'The **Up next** card puts one lead in front of you. Call or WhatsApp them, then log how it went.',
        ],
        links: [{ label: 'Today', href: '/dashboard/today' }],
      },
      {
        id: 'today-log', q: 'What happens when I log a call on Today?', keywords: 'spoke no answer call back later not interested log outcome',
        a: [
          { list: [
            '**Spoke to them** logs the call.',
            '**No answer** logs it and counts towards the NC rule.',
            '**Call back later** creates a call-back task for in 2 hours, this evening at 6 pm or tomorrow at 11 am.',
            '**Not interested** logs it, but doesn\'t disqualify the lead.',
            '**Sent a WhatsApp** logs the message.',
          ] },
          'Every one of these can be undone straight after.',
        ],
      },
    ],
  },

  // ─── Power dialer ─────────────────────────────────────────────────────────
  {
    id: 'dialer', title: 'Power dialer', blurb: 'Calling leads one after another', Icon: PhoneCall, color: '#067647',
    faqs: [
      {
        id: 'dialer-how', q: 'How does the Power Dialer work?', keywords: 'dialer calling session queue list smart queue',
        a: [
          { steps: [
            'Choose **who to call**: Smart queue, First calls, Hot, Warm, Cold or Gone quiet (no update in 7+ days).',
            'Choose the **order** (Priority, Intent, Newest or Waiting) and how many: 10, 25, 50 or all.',
            'Click **Start calling**. **Call** dials the lead from your own phone, and the timer runs on screen.',
            'After each call, pick how it went and press **Save & next**.',
          ] },
          'Keyboard shortcuts keep you fast: **C** call, **N** no answer, **E** end call, **S** skip, **L** log a call, **1** to **4** for the outcome and **Enter** to save.',
        ],
        links: [{ label: 'Power Dialer', href: '/dashboard/calls' }],
      },
      {
        id: 'dialer-outcomes', q: 'What gets saved after each call?', keywords: 'outcome connected no answer call back not interested disqualify note',
        a: [
          'You choose one of four outcomes, with an optional note:',
          { list: [
            '**Connected:** you spoke to them.',
            '**No answer:** counts towards the NC rule. The fifth in a row disqualifies the lead.',
            '**Call back:** pick a time and a call-back task is added to the lead.',
            '**Not interested:** switch on **Also mark as Disqualified** to close it out.',
          ] },
          'Each call is saved on the lead with its length and note. Any outcome except No answer moves a New lead to Cold.',
        ],
      },
      {
        id: 'dialer-computer', q: 'Can I call from my computer?', keywords: 'browser calling internet voip exotel click to call computer laptop',
        a: [
          'Not from the Power Dialer: it dials from your phone. On a lead\'s page, the **Call** button can use click-to-call when LeadGap has it switched on. LeadGap rings your mobile first, then connects you to the lead, and the call is recorded.',
          'When click-to-call isn\'t on, **Call** just times the call you make from your phone so you can log it.',
        ],
      },
      {
        id: 'dialer-tab', q: 'What if I close the tab in the middle of a session?', keywords: 'session lost reload refresh tab closed resume',
        a: [
          'Calls you\'ve saved are already on the leads. The session itself, meaning your list and where you were in it, survives a reload but not closing the tab. Start a new session to carry on.',
        ],
      },
    ],
  },

  // ─── WhatsApp & email ─────────────────────────────────────────────────────
  {
    id: 'outreach', title: 'WhatsApp & email', blurb: 'Broadcasts and sequences', Icon: Megaphone, color: '#067647',
    faqs: [
      {
        id: 'broadcast', q: 'How does a WhatsApp broadcast work?', keywords: 'broadcast bulk whatsapp mass message interakt template',
        a: [
          'Under **Outreach → Broadcast**, pick who gets it by stage, source, city, intent score or property type, write the message and send. Broadcasts go out through LeadGap\'s WhatsApp Business connection.',
          { list: [
            'Up to 1,000 leads per broadcast, and 5 broadcasts an hour.',
            'Only leads with a valid Indian mobile number are included.',
            'If WhatsApp isn\'t connected for your workspace yet, the page runs a test and says that nothing was sent.',
          ] },
        ],
        links: [{ label: 'Broadcast', href: '/dashboard/outreach/broadcast' }],
      },
      {
        id: 'sequences', q: 'How do sequences work?', keywords: 'sequence drip follow up automation email whatsapp steps cadence',
        a: [
          'A sequence is a set of steps sent over days, like a WhatsApp on day 1, an email on day 3 and a call reminder on day 5. Build one under **Outreach → Sequences**, then add a lead to it with **Add to sequence** on the lead\'s page.',
          { list: [
            'LeadGap checks for due steps every 2 hours.',
            '**Email** steps are sent for you. **Call reminder** steps appear in the bell at the top.',
            '**Pausing** a sequence holds every lead where they are. Deleting it stops them.',
          ] },
          { note: 'WhatsApp steps need an approved WhatsApp template, which can\'t be picked in the builder yet.', tone: 'amber' },
        ],
        links: [{ label: 'Sequences', href: '/dashboard/outreach/sequences' }],
      },
    ],
  },

  // ─── AI ───────────────────────────────────────────────────────────────────
  {
    id: 'ai', title: 'AI Advisor & Workflows', blurb: 'What the AI does and what it reads', Icon: Robot, color: '#5925DC',
    faqs: [
      {
        id: 'advisor', q: 'What can the AI Advisor do?', keywords: 'ai advisor chat script objection whatsapp email strategy',
        a: [
          'Ask it about your pipeline or about one lead. Pick a mode for the answer you need: **Strategy**, **WhatsApp**, **Call script**, **Objection** or **Email**.',
          { list: [
            'It reads a summary of your recent leads. Mention a CS ID and it also reads that lead\'s details, recent activity and open tasks.',
            'It doesn\'t have live market data, so it won\'t quote market numbers.',
            'It never sends anything itself. It opens WhatsApp or your email with the draft, and **Log it** records that you sent it.',
          ] },
          'Your chats and saved scripts are kept in this browser only.',
        ],
        links: [{ label: 'AI Advisor', href: '/dashboard/advisor' }],
      },
      {
        id: 'workflows', q: 'What do AI Workflows do?', keywords: 'workflows deal coach suggestions apply undo automation',
        a: [
          'Workflows suggest the next move. Nothing changes until you tap **Apply**, and anything applied can be undone from the log.',
          { list: [
            '**Deal Coach:** missed calls with no call-back, overdue follow-ups, new leads nobody has called, and Hot or Warm leads going quiet.',
            '**WhatsApp replies:** reads what leads write back and suggests a stage, a follow-up or a budget.',
            '**Call notes:** turns your call notes into a summary and a next step.',
          ] },
        ],
        links: [{ label: 'Workflows', href: '/dashboard/advisor/workflows' }],
      },
    ],
  },

  // ─── Analytics & scores ───────────────────────────────────────────────────
  {
    id: 'scores', title: 'Analytics & scores', blurb: 'The intent score, reports and charts', Icon: ChartBar, color: '#5925DC',
    faqs: [
      {
        id: 'intent-score', q: 'What is the intent score?', keywords: 'score intent high medium low points rating lead score',
        a: [
          'A number from 0 to 100 for how likely a lead is to buy. **70 and above is High**, 40 to 69 is Medium and below 40 is Low.',
          'It starts from the lead\'s details:',
          { list: [
            'Phone (+20) and email (+10)',
            'Budget: both ends given (+25) or one (+15)',
            'Timeline: immediate or within a month (+25), 1 to 3 months (+15), 6 months (+5)',
            'Source: website or referral (+20), a property portal (+15), Facebook or Google (+10), anything else (+5)',
          ] },
          'Then every logged step adds to it, up to a limit for each kind: a WhatsApp reply +12, a site visit done +30, an EOI +40 and a closed deal +50, for example. It updates each time you log something.',
        ],
      },
      {
        id: 'analytics', q: 'What does Analytics show?', keywords: 'analytics insights reports charts sources funnel period',
        a: [
          'Under **Insights → Analytics**: how many leads came in, where they came from, how they moved through the stages, and which leads to act on now. Change the period at the top of the page.',
          { list: [
            '**Team analytics** (Teams) shows your team\'s activity and results.',
            '**Reports** turns your numbers into a report you can print or send.',
          ] },
        ],
        links: [{ label: 'Analytics', href: '/dashboard/analytics' }],
      },
    ],
  },

  // ─── Team & plans ─────────────────────────────────────────────────────────
  {
    id: 'team', title: 'Team & plans', blurb: 'Solo or Teams, roles and inviting people', Icon: UsersThree, color: '#1D4ED8',
    faqs: [
      {
        id: 'invite-team', q: 'How do I invite my team?', keywords: 'invite add agent teammate member join welcome',
        a: [
          'Use **Invite team** in the sidebar (Teams plan, admins):',
          { steps: [
            '**Add people.** A name and mobile number is enough. Add several at once, or paste a list.',
            '**Say hello.** Send each person a welcome from your own WhatsApp or email. LeadGap writes it, you press send.',
            '**Give them leads.** On the **Team** page, **Assign leads** shares waiting leads between the people you pick.',
          ] },
          { note: 'Teammates can\'t sign in with their own account yet, so there\'s no invite link. For now you assign their leads, and their work shows up in team reports.' },
        ],
        links: [{ label: 'Invite team', href: '/dashboard/invite' }, { label: 'Team', href: '/dashboard/team' }],
      },
      {
        id: 'solo-vs-teams', q: 'What is the difference between Solo and Teams?', keywords: 'solo teams plan difference upgrade',
        a: [
          '**Solo** is for one person working their own leads. **Teams** is for a broker with agents, and adds:',
          { list: [
            'Invite team and the **Team** page: a leaderboard, and **Assign leads** to share leads out',
            '**Team analytics** and team reports',
            'Admin and agent roles',
          ] },
        ],
        links: [{ label: 'Plan & billing', href: '/dashboard/settings#billing' }],
      },
      {
        id: 'roles', q: 'What can an agent see compared with an admin?', keywords: 'role admin agent manager access permission rbac',
        a: [
          'Admins (and managers) run the workspace. Agents work their own leads:',
          { list: [
            '**Agents:** the leads assigned to them, Today, Pipeline, Outreach, the AI Advisor, their own reports, and their own profile and password.',
            '**Admins also get:** every lead, the Team page and Team analytics, lead routing, portals, billing and data export, and they can change business details and AI preferences.',
          ] },
          { note: 'Teammates can\'t sign in with their own account yet. Until they can, roles decide who leads are assigned to and who appears in team reports.' },
        ],
        links: [{ label: 'Team & access', href: '/dashboard/settings#team' }],
      },
      {
        id: 'plans', q: 'What do the plans cost, and how do I upgrade or cancel?', keywords: 'price pricing plan billing pay upgrade cancel razorpay free pro team subscription',
        a: [
          { list: [
            '**Free:** ₹0',
            '**Pro:** ₹2,499 a month',
            '**Team:** ₹5,999 a month, for up to 5 agents',
          ] },
          'Upgrade in **Settings → Plan & billing**. Payment is through Razorpay. To cancel, choose **Cancel at period end** to keep your plan until the date you\'ve paid up to, or cancel now.',
        ],
        links: [{ label: 'Plan & billing', href: '/dashboard/settings#billing' }],
      },
    ],
  },

  // ─── Account & data ───────────────────────────────────────────────────────
  {
    id: 'account', title: 'Account & data', blurb: 'Password, exports, deleting and alerts', Icon: ShieldCheck, color: '#344054',
    faqs: [
      {
        id: 'password', q: 'How do I change my password or email?', keywords: 'password email change reset forgot login sign in security',
        a: [
          { list: [
            '**Password:** Settings → **Security** → **Change password**. It needs at least 8 characters. **Sign out other devices** is on the same page.',
            '**Email:** Settings → **Profile** → **Change** next to your email. The change applies once you click the link we send to the new address.',
          ] },
          'Forgot your password and can\'t sign in? Email us from the address on your account and we\'ll help you back in.',
        ],
        links: [{ label: 'Security', href: '/dashboard/settings#security' }],
        mail: { label: 'I can\'t sign in', subject: 'I can\'t sign in to LeadGap' },
      },
      {
        id: 'export', q: 'How do I export my data?', keywords: 'export download csv backup data leads activity',
        a: [
          { list: [
            '**Everything:** Settings → **Data & privacy** → download all your leads, and all their activity, as CSV files.',
            '**The list on screen:** **Export CSV** on Leads downloads what you\'re looking at. Select leads first to export just those.',
            '**The board:** **Export** on Pipeline includes each lead\'s stage, days since the last update and next step.',
          ] },
        ],
        links: [{ label: 'Data & privacy', href: '/dashboard/settings#data' }],
      },
      {
        id: 'delete-workspace', q: 'How do I delete my workspace?', keywords: 'delete account close remove erase gdpr data deletion',
        a: [
          'Deleting isn\'t automatic yet. Download your leads and activity from **Settings → Data & privacy** first, then ask us from the address on your account and the LeadGap team will delete your workspace and all its data.',
        ],
        links: [{ label: 'Data & privacy', href: '/dashboard/settings#data' }],
        mail: { label: 'Ask to delete my workspace', subject: 'Please delete my LeadGap workspace', body: 'Please delete my LeadGap workspace and all its data. I have downloaded what I need.\n\n' },
      },
      {
        id: 'alerts', q: 'What does LeadGap notify me about?', keywords: 'notification bell alert reminder email digest',
        a: [
          'The **bell** in the top bar shows LeadGap\'s alerts, such as call reminders from your sequences. Your follow-ups live on **Today** and **Tasks** rather than in the bell.',
          'LeadGap doesn\'t send alerts by email yet.',
        ],
        links: [{ label: 'Today', href: '/dashboard/today' }, { label: 'Tasks', href: '/dashboard/tasks' }],
      },
    ],
  },
]
