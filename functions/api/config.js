import { SPEC } from '../../lib/spec.js'
import { brandName, json } from '../../lib/proxy.js'

export function onRequestGet({ env }) {
  return json({ ...SPEC, brand: brandName(env, SPEC.title) }, 200, { 'Cache-Control': 'public, max-age=300' })
}
