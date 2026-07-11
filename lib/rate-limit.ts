/**
 * In-memory rate limiter.
 * Works per serverless instance — good enough for launch-level protection.
 * Upgrade to @upstash/ratelimit + Redis when scaling to multi-region.
 *
 * Usage:
 *   const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
 *   if (!checkRateLimit(`ai:${ip}`, 10, 60_000)) {
 *     return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 *   }
 */

type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()

// Prune stale entries every 5 minutes to prevent memory growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of store) {
      if (now > bucket.resetAt) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

/**
 * Returns true if the request is within limits, false if it should be blocked.
 * @param key     Unique key — e.g. `"ai:192.168.1.1"` or `"auth:user@example.com"`
 * @param limit   Max requests allowed in the window
 * @param windowMs Window size in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= limit) return false
  bucket.count++
  return true
}

/** Convenience — extracts the best available client IP from Next.js request headers */
export function getClientIp(req: Request): string {
  const forwarded = (req.headers as Headers).get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown'
}
