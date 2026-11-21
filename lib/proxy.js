// Shared helpers for the Pages Functions. The Caelara key lives only in the Function environment and is never sent to the browser.

const FQDN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const BLOCKED_TLD = new Set(['local', 'localhost', 'internal', 'lan', 'home', 'corp', 'intranet', 'invalid', 'test', 'example', 'onion', 'arpa'])

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
  })
}

// A public hostname only: no IP literals, ports, paths or internal suffixes.
export function normaliseDomain(input) {
  if (typeof input !== 'string') return null
  const s = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  if (!FQDN.test(s)) return null
  return BLOCKED_TLD.has(s.slice(s.lastIndexOf('.') + 1)) ? null : s
}

// Only pages served by this site may call the API, so other sites cannot spend your credits. Server-to-server callers
// without browser headers are refused unless ALLOW_DIRECT_CALLS is set to "true".
export function callerAllowed(request, env) {
  const site = request.headers.get('Sec-Fetch-Site')
  if (site === 'same-origin') return true
  const host = new URL(request.url).host
  for (const h of ['Origin', 'Referer']) {
    const v = request.headers.get(h)
    if (v) {
      try {
        return new URL(v).host === host
      } catch {
        return false
      }
    }
  }
  return env.ALLOW_DIRECT_CALLS === 'true'
}

// Calls one Caelara endpoint with the configured key. Payment and key problems come back as readable errors.
export async function callCaelara(fetcher, url, key, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json', 'X-Caelara-Key': key, 'User-Agent': 'CaelaraLabs-Starter/1.0' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetcher(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000) })
  } catch {
    return { ok: false, status: 502, error: 'The data service did not answer in time. Try again.' }
  }
  let parsed = null
  try {
    parsed = await res.json()
  } catch {
    /* not JSON */
  }
  if (res.status === 401 || res.status === 402 || res.status === 429) return { ok: false, status: 503, error: 'The service key is missing, out of credit or rate limited. The site owner needs to check the Caelara key.' }
  if (!res.ok || !parsed) return { ok: false, status: 502, error: typeof parsed?.error === 'string' ? parsed.error : 'The data service returned an error.' }
  return { ok: true, body: parsed }
}

// Common gate for every handler: caller check, then key present. Returns a Response to send, or null to continue.
export function gate(request, env) {
  if (!callerAllowed(request, env)) return json({ error: 'This endpoint is only available from the site itself.' }, 403)
  if (!env.CAELARA_API_KEY) return json({ error: 'CAELARA_API_KEY is not set. Add it as a secret in your Cloudflare project.' }, 503)
  return null
}

export async function readJsonBody(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length') || 0)
  if (declared > maxBytes) return { error: 'The request body is too large.' }
  let text
  try {
    text = await request.text()
  } catch {
    return { error: 'The request body could not be read.' }
  }
  if (text.length > maxBytes) return { error: 'The request body is too large.' }
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? { value } : { error: 'Send a JSON object.' }
  } catch {
    return { error: 'Send valid JSON.' }
  }
}

export const brandName = (env, fallback) => (env.NEXT_PUBLIC_BRAND_NAME || fallback).slice(0, 60)
