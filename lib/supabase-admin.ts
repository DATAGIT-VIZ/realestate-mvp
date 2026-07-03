/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — use only in server-side API routes, never in client components.
 * If SUPABASE_SERVICE_ROLE_KEY is not set, returns null and callers should skip the operation.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null

  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return _admin
}
