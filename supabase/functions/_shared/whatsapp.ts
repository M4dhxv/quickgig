// Shared WhatsApp sender using the approved jobalerts template
// {{1}}=first name  {{2}}=role  {{3}}=city  {{4}}=job line

export async function sendJobAlert(toPhone: string, vars: Record<string, string>): Promise<boolean> {
  const sid      = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token    = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from     = Deno.env.get('TWILIO_WHATSAPP_FROM')
  const template = Deno.env.get('TWILIO_WHATSAPP_ALERT_TEMPLATE_SID')
  if (!sid || !token || !from || !template) return false

  const e164 = toPhone.startsWith('+') ? toPhone : '+' + toPhone
  const body = new URLSearchParams()
  body.set('To',               `whatsapp:${e164}`)
  body.set('From',             from)
  body.set('ContentSid',       template)
  body.set('ContentVariables', JSON.stringify(vars))

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${sid}:${token}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!res.ok) { console.error('whatsapp: send failed', e164, await res.text()); return false }
  return true
}

export function buildVars(opts: {
  name?: string; role?: string; location?: string
  jobs: { title: string; company?: string; url?: string; location?: string }[]
  appUrl: string
}): Record<string, string> {
  const firstName = (opts.name || 'there').trim().split(/\s+/)[0]
  const city  = (opts.location || '').split(',')[0].trim() || 'your area'
  // First job gets the direct link; additional jobs listed briefly after
  const [first, ...rest] = opts.jobs
  const firstLoc = first?.location ? first.location.split(',')[0].trim() : ''
  const firstLine = first
    ? `${first.title}${firstLoc ? ', ' + firstLoc : ''}${first.company ? ' at ' + first.company : ''}${first.url ? ': ' + first.url : ''}`
    : `New roles near you: ${opts.appUrl}`
  const restLine = rest.length > 0
    ? ' | ' + rest.map(j => `${j.title}${j.location ? ', ' + j.location.split(',')[0].trim() : ''}`).join(' | ')
    : ''
  const jobLine = firstLine + restLine
  return {
    '1': firstName,
    '2': (opts.role || 'frontline').trim(),
    '3': city,
    '4': jobLine,
  }
}
