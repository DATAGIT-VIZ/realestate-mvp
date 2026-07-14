export interface PortalConfig {
  id:           string
  name:         string
  color:        string
  bg:           string
  emoji:        string
  tagline:      string
  webhookPath:  string
  method:       'account_manager' | 'self_serve' | 'zapier'
  params:       string[]
  steps:        string[]
  managerEmail?: string
  docsUrl?:     string
}

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://realestate-mvp-two.vercel.app'

export const PORTALS: PortalConfig[] = [
  {
    id:          'magicbricks',
    name:        'MagicBricks',
    color:       '#a000c8',
    bg:          'rgba(160,0,200,0.08)',
    emoji:       '🧱',
    tagline:     'India\'s largest property portal',
    webhookPath: `${BASE}/api/ingest/magicbricks`,
    method:      'account_manager',
    params:      ['Name', 'Mobile', 'Email', 'City', 'Budget', 'Property Type', 'Timeline', 'Lead Id', 'Project Name'],
    steps: [
      'Copy the webhook URL below',
      'Open WhatsApp or Email and send it to your MagicBricks Account Manager',
      'Ask them to enable "CRM Push Integration" and configure the webhook',
      'Leads will start appearing here within 24–48 hours of setup',
    ],
    managerEmail: 'crmsupport@magicbricks.com',
  },
  {
    id:          '99acres',
    name:        '99acres',
    color:       '#2563EB',
    bg:          'rgba(37,99,235,0.08)',
    emoji:       '🏘️',
    tagline:     'India\'s No.1 real estate platform',
    webhookPath: `${BASE}/api/ingest/99acres`,
    method:      'account_manager',
    params:      ['sender_name', 'sender_phone', 'sender_email', 'city', 'budget_min', 'budget_max', 'property_type', 'possession', 'unique_id', 'property_name'],
    steps: [
      'Copy the webhook URL below',
      'Send it to your 99acres Account Manager via WhatsApp or Email',
      'Request "Tech Integration / CRM Push" to be enabled on your account',
      'Leads will start flowing in within 1–2 business days',
    ],
    managerEmail: 'techsupport@99acres.com',
  },
  {
    id:          'housing',
    name:        'Housing.com',
    color:       '#059669',
    bg:          'rgba(5,150,105,0.08)',
    emoji:       '🏠',
    tagline:     'PropTiger & Housing.com network',
    webhookPath: `${BASE}/api/ingest/housing`,
    method:      'account_manager',
    params:      ['name', 'phone', 'email', 'city', 'locality', 'budget', 'property_type', 'lead_id', 'source'],
    steps: [
      'Copy the webhook URL below',
      'Send it to your Housing.com Account Manager',
      'Request PUSH integration to be enabled — mention it\'s for CRM lead sync',
      'Verification may take 2–3 business days',
    ],
    managerEmail: 'crm.support@housing.com',
  },
  {
    id:          'nobroker',
    name:        'NoBroker',
    color:       '#7C3AED',
    bg:          'rgba(124,58,237,0.08)',
    emoji:       '🔑',
    tagline:     'Zero brokerage property portal',
    webhookPath: `${BASE}/api/ingest/99acres`,
    method:      'account_manager',
    params:      ['name', 'mobile', 'email', 'city', 'locality', 'budget', 'property_type', 'requirement'],
    steps: [
      'Copy the webhook URL below',
      'Contact NoBroker support via WhatsApp (+91 92055 92055)',
      'Ask them to enable webhook forwarding for new enquiries',
      'Leads will appear in your dashboard once configured',
    ],
  },
  {
    id:          'facebook',
    name:        'Facebook Leads',
    color:       '#1877F2',
    bg:          'rgba(24,119,242,0.08)',
    emoji:       '📘',
    tagline:     'Meta Lead Ads — self serve, instant',
    webhookPath: `${BASE}/api/ingest/facebook`,
    method:      'self_serve',
    params:      ['first_name', 'last_name', 'phone_number', 'email', 'city', 'budget', 'property_type'],
    steps: [
      'Go to Meta Business Manager → your Lead Ad campaign',
      'Click "CRM Integrations" → "Webhooks"',
      'Paste the webhook URL and set the fields to map',
      'Test with a sample submission — leads appear instantly',
    ],
    docsUrl: 'https://www.facebook.com/business/help/webhooks',
  },
  {
    id:          'google',
    name:        'Google Ads',
    color:       '#EA4335',
    bg:          'rgba(234,67,53,0.08)',
    emoji:       '🔍',
    tagline:     'Google Lead Form Extensions',
    webhookPath: `${BASE}/api/ingest/99acres`,
    method:      'zapier',
    params:      ['Full Name', 'Phone Number', 'Email', 'City', 'Zip Code'],
    steps: [
      'In Google Ads, go to your Lead Form asset',
      'Set up a Zapier webhook trigger on new lead form submissions',
      'In Zapier, add a POST action to the webhook URL with field mappings',
      'Leads will sync automatically after each form submission',
    ],
    docsUrl: 'https://zapier.com/apps/google-ads/integrations/webhook',
  },
]

export function getPortal(id: string) {
  return PORTALS.find(p => p.id === id) ?? null
}
