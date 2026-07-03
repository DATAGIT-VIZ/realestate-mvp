const SID   = () => process.env.EXOTEL_SID   ?? ''
const KEY   = () => process.env.EXOTEL_API_KEY   ?? ''
const TOKEN = () => process.env.EXOTEL_API_TOKEN ?? ''

export function exotelConfigured() {
  return !!(process.env.EXOTEL_SID && process.env.EXOTEL_API_KEY && process.env.EXOTEL_API_TOKEN && process.env.EXOTEL_PHONE)
}

function basicAuth() {
  return 'Basic ' + Buffer.from(`${KEY()}:${TOKEN()}`).toString('base64')
}

// Normalize to 10-digit Indian number (strip +91, 91 prefix, spaces)
export function normaliseToExotel(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) return digits.slice(2)
  if (digits.startsWith('0') && digits.length === 11) return digits.slice(1)
  return digits.slice(-10)
}

export type CallInitResult = {
  callSid: string
  status: string
}

export async function initiateCall(params: {
  agentPhone: string
  leadPhone:  string
  callbackUrl: string
}): Promise<CallInitResult> {
  const url = `https://api.exotel.in/v1/Accounts/${SID()}/Calls/connect`
  const body = new URLSearchParams({
    From:                   normaliseToExotel(params.agentPhone),
    To:                     normaliseToExotel(params.leadPhone),
    CallerId:               process.env.EXOTEL_PHONE!,
    StatusCallback:         params.callbackUrl,
    'StatusCallbackEvents[]': 'terminal',
    Record:                 'true',
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Exotel ${res.status}: ${text}`)
  }

  const data = await res.json()
  return {
    callSid: data.Call?.Sid ?? '',
    status:  data.Call?.Status ?? '',
  }
}
