// Workspace plan + role system
// Solo plan: one user, no RBAC, full access to everything
// Teams plan: multiple users, RBAC applies

export type Plan = 'solo' | 'teams'
export type Role = 'admin' | 'agent'

const PLAN_KEY = 'vyapulse-plan'
const ROLE_KEY = 'vyapulse-role'

export function getPlan(): Plan {
  if (typeof window === 'undefined') return 'solo'
  return (localStorage.getItem(PLAN_KEY) as Plan) ?? 'solo'
}

export function getRole(): Role {
  if (typeof window === 'undefined') return 'admin'
  return (localStorage.getItem(ROLE_KEY) as Role) ?? 'admin'
}

export function setPlan(p: Plan) {
  localStorage.setItem(PLAN_KEY, p)
  window.dispatchEvent(new Event('plan-changed'))
}

export function setRole(r: Role) {
  localStorage.setItem(ROLE_KEY, r)
  window.dispatchEvent(new Event('plan-changed'))
}

// On Teams plan, agents are restricted from admin-only areas
export function canAccess(href: string, plan: Plan, role: Role): boolean {
  if (plan === 'solo') return true       // solo: no restrictions
  if (role === 'admin') return true      // admin: no restrictions

  // Agent restrictions on Teams plan
  const AGENT_BLOCKED = [
    '/dashboard/team',
    '/dashboard/settings/billing',
    '/dashboard/settings/routing',
  ]
  return !AGENT_BLOCKED.some(blocked => href.startsWith(blocked))
}
