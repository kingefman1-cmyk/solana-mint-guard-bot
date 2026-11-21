// node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleCheck } from '../functions/api/check.js'
import { onRequestGet as config } from '../functions/api/config.js'

const KEY = 'ck_test_value'
const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const same = { 'Sec-Fetch-Site': 'same-origin' }
const req = (qs, headers = same, method = 'GET') => new Request('https://mintguard.example-site.com/api/check' + qs, { method, headers })
const j = (o, status = 200) => new Response(JSON.stringify(o), { status })
const audit = { mint: MINT, mint_authority: null, freeze_authority: null, decimals: 6 }
const safety = { address: MINT, chain: 'solana', score: 88, risk_level: 'low', flags: [], disclaimer: 'A heuristic screen, not financial advice.' }
const upstream = (calls) => async (url, init) => { calls.push({ url: String(url), key: init.headers['X-Caelara-Key'], method: init.method }); return String(url).includes('solana-mint-auditor') ? j(audit) : j(safety) }

test('a check makes two read-only GET calls with the server-side key and returns both results', async () => {
  const calls = []
  const r = await handleCheck(req('?mint=' + MINT), { CAELARA_API_KEY: KEY }, upstream(calls))
  const b = await r.json()
  assert.equal(r.status, 200); assert.equal(calls.length, 2); assert.ok(calls.every((c) => c.key === KEY && c.method === 'GET'))
  assert.ok(calls.some((c) => c.url === `https://crypto.caelaralabs.com/v1/solana-mint-auditor?mint=${MINT}`))
  assert.ok(calls.some((c) => c.url === `https://crypto.caelaralabs.com/v1/token-safety-composite?address=${MINT}&chain=solana`))
  assert.equal(b.safety.score, 88); assert.equal(b.audit.decimals, 6); assert.deepEqual(b.unavailable, [])
  assert.ok(!JSON.stringify(b).includes(KEY), 'the key never appears in a response')
})

test('only a well-formed mint address reaches a paid call', async () => {
  const calls = []
  const f = upstream(calls)
  for (const qs of ['', '?mint=', '?mint=short', '?mint=0xabc123', '?mint=' + MINT + 'x'.repeat(10), '?mint=' + MINT.replace('E', '0'), '?mint=' + MINT + '%00']) assert.equal((await handleCheck(req(qs), { CAELARA_API_KEY: KEY }, f)).status, 400, qs)
  assert.equal(calls.length, 0)
})

test('only the site itself may call, a key must be set, and only GET is accepted', async () => {
  const f = upstream([])
  assert.equal((await handleCheck(req('?mint=' + MINT, {}), { CAELARA_API_KEY: KEY }, f)).status, 403)
  assert.equal((await handleCheck(req('?mint=' + MINT, {}), { CAELARA_API_KEY: KEY, ALLOW_DIRECT_CALLS: 'true' }, f)).status, 200)
  assert.equal((await handleCheck(req('?mint=' + MINT), {}, f)).status, 503)
  assert.equal((await handleCheck(req('?mint=' + MINT, same, 'POST'), { CAELARA_API_KEY: KEY }, f)).status, 405)
})

test('one failed call is reported as unavailable; two failures return a readable error', async () => {
  const half = async (url) => (String(url).includes('solana-mint-auditor') ? j({}, 500) : j(safety))
  const b = await (await handleCheck(req('?mint=' + MINT), { CAELARA_API_KEY: KEY }, half)).json()
  assert.deepEqual(b.unavailable, ['mint audit']); assert.equal(b.audit, null); assert.equal(b.safety.risk_level, 'low')
  assert.equal((await handleCheck(req('?mint=' + MINT), { CAELARA_API_KEY: KEY }, async () => j({}, 402))).status, 503)
  const c = await (await config({ env: {} })).json()
  assert.equal(c.method, 'GET'); assert.equal(c.path, '/api/check'); assert.deepEqual(c.headline, ['safety.score', 'safety.risk_level'])
})
