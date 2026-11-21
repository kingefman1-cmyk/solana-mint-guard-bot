// GET /api/check?mint=<Solana mint address>
// Read-only. One check = two calls: the SPL mint audit (authorities, supply, holder concentration) and the token safety score.
// Nothing here signs, holds keys or sends funds. A JSON endpoint a chat bot or script can call is included; a chat bot is not.
import { callCaelara, gate, json } from '../../lib/proxy.js'

export const CRYPTO_HOST = 'https://crypto.caelaralabs.com'
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export async function handleCheck(request, env, fetcher = fetch) {
  if (request.method !== 'GET') return json({ error: 'Send a GET request.' }, 405, { Allow: 'GET' })
  const blocked = gate(request, env)
  if (blocked) return blocked
  const mint = (new URL(request.url).searchParams.get('mint') || '').trim()
  if (!BASE58.test(mint)) return json({ error: 'Enter a Solana mint address (32 to 44 base58 characters).' }, 400)
  const key = env.CAELARA_API_KEY
  const [audit, safety] = await Promise.all([
    callCaelara(fetcher, `${CRYPTO_HOST}/v1/solana-mint-auditor?mint=${encodeURIComponent(mint)}`, key),
    callCaelara(fetcher, `${CRYPTO_HOST}/v1/token-safety-composite?address=${encodeURIComponent(mint)}&chain=solana`, key),
  ])
  if (!audit.ok && !safety.ok) return json({ error: audit.error }, audit.status)
  return json({
    mint,
    audit: audit.ok ? audit.body : null,
    safety: safety.ok ? safety.body : null,
    unavailable: [!audit.ok && 'mint audit', !safety.ok && 'safety score'].filter(Boolean),
  })
}

export const onRequest = ({ request, env }) => handleCheck(request, env)
