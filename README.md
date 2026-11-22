[![Powered by Caelara Labs](https://benchmarks.caelaralabs.com/verify/powered-by.svg)](https://caelaralabs.com)

# Mint Guard (white-label starter)

A small Cloudflare Pages site that checks a Solana token mint with the Caelara crypto suite. It is read-only: it signs nothing, holds no keys and sends no funds. It includes a JSON endpoint that a chat bot or script can call; a chat bot itself is not included.

It is a static page plus Pages Functions. Your Caelara key stays in the Function environment and is never sent to the browser.

## One-click deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kingefman1-cmyk/solana-mint-guard-bot)

The button opens Cloudflare's deploy flow for this repository. When it finishes, add your key as the `CAELARA_API_KEY` secret (step 4 below); the site shows an error until it is set.

## Set up in about five minutes

1. Get a key. A free trial key (50 calls, no card) is at https://caelaralabs.com/#trial. For more volume, email ops@caelaralabs.com.
2. Install and log in to Cloudflare:
   ```bash
   npm install
   npx wrangler login
   ```
3. Set your brand name in `wrangler.toml` (`NEXT_PUBLIC_BRAND_NAME`).
4. Deploy and add the key as a secret:
   ```bash
   npm run deploy
   npx wrangler pages secret put CAELARA_API_KEY --project-name solana-mint-guard
   ```
5. Open the `*.pages.dev` address Wrangler prints. Add your own domain under Pages > Custom domains.

Local run: copy `.dev.vars.example` to `.dev.vars`, fill in the key, then `npm run dev`.

## What it costs

One check makes two calls: the mint audit at 0.005 USDC and the token safety score at 0.025 USDC, so 0.03 USDC per check. A free trial key (50 calls) covers about 25 checks.

The site has no billing of its own: add a login and a payment step in front of the API before you open it to the public.

## Endpoints used

| Call | Purpose |
|---|---|
| `GET https://crypto.caelaralabs.com/v1/solana-mint-auditor` | Mint and freeze authority, supply, decimals, extensions, holder concentration |
| `GET https://crypto.caelaralabs.com/v1/token-safety-composite` | Safety score, risk level and flags for the mint |

Results are heuristic. A clean result is not a guarantee of anything, and the page says so.

## Call it from your own app

```bash
curl -s "https://YOUR-SITE.pages.dev/api/check?mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
```

By default only pages served by the same site may call the API, so other sites cannot spend your credits. To call it from your own server, set `ALLOW_DIRECT_CALLS=true` in `wrangler.toml` and put your own authentication in front of it first: with that flag on, anyone who can reach the URL can spend your credits.

## Drop-in pre-buy guard (Pump.fun, sniper bots, Solana agents)

Ten lines you can paste into a Pump.fun bot, a sniper bot, or a Solana agent built on `solana-agent-kit` or elizaOS. It runs before the buy: the mint audit checks mint and freeze authority, and Shield returns an `allow`, `review` or `block` verdict for the mint. Anything other than `allow` with both authorities renounced skips the buy.

```js
// Pre-buy guard for Pump.fun bots, sniper bots and Solana agents. Read-only heuristic screening: never touches keys, wallets or transactions.
const H = { 'X-Caelara-Key': process.env.CAELARA_KEY, 'content-type': 'application/json' } // or pay per call with x402 (Base USDC)
export async function preBuyGuard(mint) {
  const [audit, shield] = await Promise.all([
    fetch(`https://crypto.caelaralabs.com/v1/solana-mint-auditor?mint=${encodeURIComponent(mint)}`, { headers: H }).then((r) => r.json()), // $0.005
    fetch('https://shield.caelaralabs.com/v1/shield/tx', { method: 'POST', headers: H, body: JSON.stringify({ token: mint, chain: 'solana' }) }).then((r) => r.json()), // $0.050
  ])
  const ok = shield.verdict === 'allow' && !audit.mint_authority && !audit.freeze_authority
  return { ok, verdict: shield.verdict, findings: shield.findings ?? [], audit } // usage: if (!(await preBuyGuard(mint)).ok) return // skip the buy
}
```

- **Cost per check:** `GET /v1/solana-mint-auditor` at 0.005 USDC plus `POST /v1/shield/tx` at 0.050 USDC, so 0.055 USDC.
- **Auth:** an `X-Caelara-Key` header (free 50-call trial at https://caelaralabs.com/#trial), or pay each call with x402 USDC on Base instead of a key.
- **Read-only:** heuristic screening only. It holds no keys, signs nothing and has no custody of any wallet. A pass is not a guarantee that a token is safe.

The file is `examples/prebuy-guard.mjs`; `npm test` covers it.

## Security notes

- The Caelara key is read only inside the Pages Functions and is never returned in a response.
- Input is validated before any paid call is made.
- Every value from the API is shown with `textContent`, never as HTML, and the page ships a strict Content-Security-Policy.
- No secret, wallet or key is stored in this repository. `.dev.vars` is git-ignored.

## Files

| File | What it does |
|---|---|
| `functions/api/check.js` | GET /api/check: validates the address, makes the two calls with your key, returns both results |
| `functions/api/config.js` | Brand and form settings for the page |
| `lib/proxy.js` | Shared helpers: caller check, key gate, upstream call |
| `lib/spec.js` | The form and result settings for the page |
| `public/` | The static page, script and styles |
| `examples/prebuy-guard.mjs` | The 10-line drop-in pre-buy guard for bots and agents |
| `test/` | Unit tests: `npm test` |

## Optional: boot preflight with Caelara Shield

If this kit runs inside a bot or an agent, you can clear its instructions and tools once at start-up. Caelara Shield screens the
system prompt and tool descriptions for injection, tool poisoning and embedded secrets, and returns a `clearance_id` (a SHA-256
audit receipt anyone can verify). Send it as `X-Caelara-Clearance` on later Caelara calls.

```bash
curl -s -X POST https://shield.caelaralabs.com/v1/shield/preflight   -H "X-Caelara-Key: $CAELARA_KEY" -H "Content-Type: application/json"   -d '{"agent":"my-bot","system_prompt":"You summarise invoices.","tools":["read_invoice"]}'
```

It costs 0.005 USDC per run (or one call on a Caelara key) and is opt-in: the kit works unchanged without it.

## License

MIT. See `LICENSE`.
