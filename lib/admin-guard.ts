import { NextRequest, NextResponse } from 'next/server'

/**
 * Guards seed/test-utility routes.
 *
 * In production: always blocks (404).
 * In dev/staging: blocks unless X-Admin-Secret header matches ADMIN_SECRET env var.
 *   If ADMIN_SECRET is not set, the route is open in dev (no friction during local work).
 *
 * Usage:
 *   const guard = requireAdminSecret(req)
 *   if (guard) return guard
 */
export function requireAdminSecret(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const secret = process.env.ADMIN_SECRET
  if (secret) {
    const header = req.headers.get('x-admin-secret')
    if (header !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return null
}
