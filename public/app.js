// Front end. The form and the result headline come from /api/config; every value from the API is inserted with textContent, never as HTML.
const $ = (id) => document.getElementById(id)

function el(tag, text, cls) {
  const n = document.createElement(tag)
  if (text !== undefined) n.textContent = text
  if (cls) n.className = cls
  return n
}

export function pathGet(obj, path) {
  return String(path).split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
}

// Pills for the configured headline fields that are present; otherwise the first few plain values.
export function headlinePills(result, paths) {
  const picked = (paths || []).map((p) => [p, pathGet(result, p)]).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
  if (picked.length) return picked.map(([p, v]) => `${p.split('.').pop()}: ${v}`)
  return Object.entries(result || {}).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v)).slice(0, 4).map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`)
}

function buildForm(cfg) {
  const f = $('f')
  f.replaceChildren()
  for (const fld of cfg.fields) {
    const id = 'fld-' + fld.name
    f.append(Object.assign(el('label', fld.label), { htmlFor: id }))
    const input = fld.type === 'textarea' ? el('textarea') : el('input')
    if (fld.type !== 'textarea') input.type = 'text'
    Object.assign(input, { id, name: fld.name, placeholder: fld.placeholder || '', maxLength: fld.maxlength || 2000, required: !!fld.required, rows: fld.rows || 8 })
    f.append(input)
  }
  const go = el('button', cfg.button || 'Run')
  go.type = 'submit'
  f.append(go)
  return go
}

async function run(cfg, form) {
  const data = Object.fromEntries(cfg.fields.map((f) => [f.name, (form.elements[f.name].value || '').trim()]).filter(([, v]) => v))
  if (cfg.method === 'POST') return fetch(cfg.path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  return fetch(cfg.path + '?' + new URLSearchParams(data).toString())
}

async function main() {
  const status = $('status')
  let cfg
  try {
    cfg = await (await fetch('/api/config')).json()
  } catch {
    status.textContent = 'The page could not load its settings. Reload to try again.'
    return
  }
  $('brand').textContent = cfg.brand
  document.title = cfg.title + ' | ' + cfg.brand
  const go = buildForm(cfg)
  $('f').addEventListener('submit', async (ev) => {
    ev.preventDefault()
    go.disabled = true
    status.className = 'status'
    status.textContent = 'Working...'
    $('out').hidden = true
    try {
      const res = await run(cfg, $('f'))
      const body = await res.json().catch(() => null)
      if (!res.ok || !body) throw new Error((body && body.error) || 'Something went wrong. Try again.')
      const pills = $('pills')
      pills.replaceChildren(...headlinePills(body, cfg.headline).map((t) => el('span', t, 'pill')))
      $('raw').textContent = JSON.stringify(body, null, 2)
      $('out').hidden = false
      status.textContent = ''
    } catch (e) {
      status.className = 'status err'
      status.textContent = e.message
    } finally {
      go.disabled = false
    }
  })
}

if (typeof document !== 'undefined') main()
