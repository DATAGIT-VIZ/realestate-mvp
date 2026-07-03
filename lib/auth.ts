import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

/**
 * Call at the top of every /api/crm/* route handler.
 * Returns { userId, response: null } on success, or { userId: null, response: 401 } if not authenticated.
 *
 * Usage:
 *   const { userId, response } = await requireAuth()
 *   if (response) return response
 */
export async function requireAuth(): Promise<{
  userId: string | null
  response: NextResponse | null
}> {
  // Dev bypass: set DEV_BYPASS_AUTH=true in .env.local to skip login
  if (process.env.DEV_BYPASS_AUTH === 'true') {
    return { userId: '00000000-0000-0000-0000-000000000001', response: null }
  }

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    )
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return { userId: null, response: NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 }) }
    }

    return { userId: session.user.id, response: null }
  } catch {
    return { userId: null, response: NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 }) }
  }
}

/**
 * Verify a shared secret header for ingest webhook routes (portals, WhatsApp).
 * Portals send: X-Webhook-Secret: <value matching INGEST_WEBHOOK_SECRET env var>
 */
export function requireWebhookSecret(req: Request): NextResponse | null {
  const secret = process.env.INGEST_WEBHOOK_SECRET
  if (!secret) return null // if not configured, allow (dev mode)

  const header = req.headers.get('x-webhook-secret') ?? req.headers.get('x-hub-signature-256')
  if (header !== secret) {
    return NextResponse.json({ data: null, error: 'Invalid webhook secret' }, { status: 401 })
  }
  return null
}
