'use client'
/* ============================================================================
   INGEST PANEL — the "drop stuff in and it fills the fields" component, mounted
   at the top of the Clients edit view. Drop or paste content → the shared engine
   detects and routes it → you confirm/re-route, place any prose → Apply uploads
   files to Media and saves the client as a DRAFT. Review the populated fields,
   then Publish. Same engine as the standalone prototype and the future Figma
   plugin; only the "apply" end is real here.
   ========================================================================== */
import React, { useMemo, useRef, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { classify, groupByTarget, TARGETS } from '../ingest/classify.js'
import { applyIngest } from '../ingest/applyPatch.js'

type Detection = any
const TARGET_KEYS = Object.keys(TARGETS)

const GLYPH: Record<string, string> = { font: 'Aa', motion: '►', download: '⤓', downloadAll: '⤓', logo: '◆', image: '▣', text: '¶' }

export const IngestPanel: React.FC = () => {
  const { id } = useDocumentInfo()
  const [dets, setDets] = useState<Detection[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [over, setOver] = useState(false)
  const fileFor = useRef<Map<string, File>>(new Map())

  const update = () => setDets((d) => [...d])

  const addItems = (items: any[]) => {
    if (!items.length) return
    setDets((d) => [...d, ...classify(items)])
    setMsg(null)
  }

  const fromDataTransfer = (dt: DataTransfer) => {
    const items: any[] = []
    for (const f of Array.from(dt.files || [])) { items.push({ type: 'file', name: f.name, mime: f.type, size: f.size }); fileFor.current.set(f.name, f) }
    const text = dt.getData?.('text/plain')
    if (text && text.trim() && (!dt.files || dt.files.length === 0)) items.push({ type: 'text', text })
    addItems(items)
  }

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setOver(false); fromDataTransfer(e.dataTransfer) }
  const onPaste = (e: React.ClipboardEvent) => {
    const dt = e.clipboardData; if (!dt) return
    const items: any[] = []
    for (const f of Array.from(dt.files || [])) { items.push({ type: 'file', name: f.name, mime: f.type, size: f.size }); fileFor.current.set(f.name, f) }
    const text = dt.getData('text/plain')
    if (text && text.trim() && (!dt.files || dt.files.length === 0)) items.push({ type: 'text', text })
    if (items.length) { e.preventDefault(); addItems(items) }
  }
  const onBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const items: any[] = []
    for (const f of Array.from(e.target.files || [])) { items.push({ type: 'file', name: f.name, mime: f.type, size: f.size }); fileFor.current.set(f.name, f) }
    addItems(items); e.target.value = ''
  }

  const loadExample = () => addItems([
    { type: 'text', text: 'Sky #6BB4F8\nAzure #238FF4\nSignal #0B78DE\nInk #010A13\nSand #FADF93' },
    { type: 'file', name: 'wordmark.svg', mime: 'image/svg+xml' },
    { type: 'file', name: 'GeneralSans-Semibold.otf', mime: 'font/otf' },
    { type: 'text', text: 'We partner with companies to optimize operational execution using our purpose-built agentic platform.' },
  ])

  const unresolved = dets.some((d) => !d.target)
  const groups = useMemo(() => groupByTarget(dets), [dets])
  const order = ['_needsChoice', ...TARGET_KEYS]

  const apply = async () => {
    if (!id) { setMsg({ kind: 'err', text: 'Save the client once before ingesting, so files have somewhere to attach.' }); return }
    setBusy(true); setMsg(null)
    try {
      const withFiles = dets.filter((d) => !d.data?.file || fileFor.current.has(d.data.file))
      const res = await applyIngest({ base: '', docId: id as any, detections: withFiles, fileFor: fileFor.current })
      setMsg({ kind: 'ok', text: `Applied ${res.applied} item(s) as a draft. Reloading to show the fields…` })
      setTimeout(() => window.location.reload(), 700)
    } catch (e: any) {
      setBusy(false); setMsg({ kind: 'err', text: e?.message || String(e) })
    }
  }

  const thumb = (d: Detection) => {
    if (d.kind === 'color') return <span style={{ ...S.sw, background: d.data.hex }} />
    const f = d.data?.file && fileFor.current.get(d.data.file)
    if (f && /^image\/|svg/.test(f.type)) return <img alt="" src={URL.createObjectURL(f)} style={S.thumb} />
    return <span style={S.glyph}>{GLYPH[d.kind] || '•'}</span>
  }

  return (
    <div style={S.wrap} onPaste={onPaste}>
      <div
        style={{ ...S.zone, ...(over ? S.zoneOver : null), ...(dets.length ? S.zoneSlim : null) }}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('ingest-file')?.click()}
        role="button"
      >
        <strong style={{ fontSize: 14 }}>Drop files or paste to fill fields</strong>
        <div style={S.sub}>hex · SVG · fonts · images · video · zip · tokens — prose you place yourself. Nothing saves until you Apply.</div>
        <button type="button" style={S.ghost} onClick={(e) => { e.stopPropagation(); loadExample() }}>Try an example</button>
        <input id="ingest-file" type="file" multiple hidden onChange={onBrowse} />
      </div>

      {dets.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={S.bar}>
            <span style={S.muted}>{dets.length} detected</span>
            <button type="button" style={S.ghost} onClick={() => { setDets([]); fileFor.current.clear(); setMsg(null) }}>Clear all</button>
          </div>

          {order.map((key) => {
            const list = groups.get(key)
            if (!list || !list.length) return null
            const needs = key === '_needsChoice'
            return (
              <div key={key} style={{ ...S.card, ...(needs ? S.cardNeeds : null) }}>
                <div style={S.cardHead}>
                  <span style={{ fontWeight: 600, color: needs ? '#c8452f' : 'inherit' }}>{needs ? 'Needs your choice' : (TARGETS as any)[key].label}</span>
                  <span style={S.count}>{list.length}</span>
                </div>
                {list.map((d: Detection) => (
                  <div key={d.id} style={{ ...S.row, ...(d.target ? null : S.rowNeeds) }}>
                    {thumb(d)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.label}>{d.label}</div>
                      <div style={{ marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {d.kind === 'color' && <>
                          <input style={S.edit} placeholder="name" defaultValue={d.data.name || ''} onChange={(e) => { d.data.name = e.target.value }} />
                          <input style={{ ...S.edit, width: 80 }} placeholder="role" defaultValue={d.data.role || ''} onChange={(e) => { d.data.role = e.target.value }} />
                        </>}
                        {d.kind === 'font' && <>
                          <input style={S.edit} placeholder="family" defaultValue={d.data.family || ''} onChange={(e) => { d.data.family = e.target.value }} />
                          {d.data.weight && <span style={S.tag}>{d.data.weight}</span>}
                        </>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>
                      <select style={{ ...S.route, ...(d.target ? null : { borderColor: '#c8452f' }) }} value={d.target || ''} onChange={(e) => { d.target = e.target.value || null; update() }}>
                        {!d.target && <option value="">— choose a field —</option>}
                        {TARGET_KEYS.map((k) => <option key={k} value={k}>{(TARGETS as any)[k].label}</option>)}
                      </select>
                      <span title={d.confidence} style={{ ...S.conf, background: d.confidence === 'high' ? '#1f9d57' : d.confidence === 'med' ? '#d9a521' : '#c8452f' }} />
                      <button type="button" style={S.rm} title="Remove" onClick={() => { setDets((x) => x.filter((y) => y !== d)) }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 8 }}>
            {msg && <span style={{ fontSize: 13, color: msg.kind === 'ok' ? '#1f9d57' : '#c8452f' }}>{msg.text}</span>}
            <button type="button" onClick={apply} disabled={busy || unresolved || dets.length === 0} style={{ ...S.apply, ...(busy || unresolved || !dets.length ? S.applyOff : null) }}>
              {busy ? 'Applying…' : unresolved ? 'Resolve the highlighted items first' : `Apply → ${dets.length} field${dets.length === 1 ? '' : 's'} (draft)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default IngestPanel

const S: Record<string, React.CSSProperties> = {
  wrap: { margin: '0 0 1.5rem', fontFamily: 'inherit' },
  zone: { border: '1.5px dashed var(--theme-elevation-150, #e6e6e2)', borderRadius: 12, background: 'var(--theme-elevation-50, #f5f5f3)', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s, background .15s' },
  zoneOver: { borderColor: 'var(--theme-success-500, #3b49f0)', background: 'var(--theme-elevation-100, #eef)' },
  zoneSlim: { padding: '0.9rem 1.1rem', textAlign: 'left' },
  sub: { color: 'var(--theme-elevation-500, #6f6f76)', fontSize: 13, marginTop: 5 },
  ghost: { marginTop: 10, font: 'inherit', fontSize: 13, border: '1px solid var(--theme-elevation-150, #e6e6e2)', background: 'transparent', color: 'inherit', borderRadius: 8, padding: '.35rem .7rem', cursor: 'pointer' },
  bar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  muted: { color: 'var(--theme-elevation-500, #6f6f76)', fontSize: 13 },
  card: { border: '1px solid var(--theme-elevation-150, #e6e6e2)', borderRadius: 12, overflow: 'hidden', marginBottom: 10, background: 'var(--theme-elevation-0, #fff)' },
  cardNeeds: { borderColor: '#e5a99e' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, padding: '.5rem .8rem', background: 'var(--theme-elevation-50, #f5f5f3)', borderBottom: '1px solid var(--theme-elevation-150, #e6e6e2)', fontSize: 14 },
  count: { marginLeft: 'auto', fontSize: 12, color: 'var(--theme-elevation-500,#6f6f76)', border: '1px solid var(--theme-elevation-150,#e6e6e2)', borderRadius: 999, padding: '.05rem .5rem' },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '.55rem .8rem', borderBottom: '1px solid var(--theme-elevation-100, #eee)' },
  rowNeeds: { background: 'rgba(200,69,47,.05)' },
  sw: { width: 32, height: 32, borderRadius: 7, border: '1px solid rgba(0,0,0,.12)', flex: 'none', display: 'inline-block' },
  thumb: { width: 32, height: 32, borderRadius: 7, objectFit: 'cover', border: '1px solid var(--theme-elevation-150,#e6e6e2)', flex: 'none' },
  glyph: { width: 32, height: 32, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--theme-elevation-50,#f5f5f3)', border: '1px solid var(--theme-elevation-150,#e6e6e2)', color: 'var(--theme-elevation-500,#6f6f76)', flex: 'none', fontSize: 14 },
  label: { fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  edit: { font: 'inherit', fontSize: 13, border: '1px solid var(--theme-elevation-150,#e6e6e2)', background: 'var(--theme-elevation-50,#f5f5f3)', color: 'inherit', borderRadius: 6, padding: '.15rem .4rem', width: 140 },
  tag: { fontSize: 11, color: 'var(--theme-elevation-500,#6f6f76)', background: 'var(--theme-elevation-50,#f5f5f3)', border: '1px solid var(--theme-elevation-150,#e6e6e2)', borderRadius: 999, padding: '.05rem .45rem' },
  route: { font: 'inherit', fontSize: 13, border: '1px solid var(--theme-elevation-150,#e6e6e2)', background: 'var(--theme-elevation-0,#fff)', color: 'inherit', borderRadius: 7, padding: '.2rem .4rem', maxWidth: 170 },
  conf: { width: 7, height: 7, borderRadius: '50%', flex: 'none' },
  rm: { border: 0, background: 'none', color: 'var(--theme-elevation-500,#6f6f76)', fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '0 4px' },
  apply: { font: 'inherit', fontWeight: 600, fontSize: 14, border: 0, borderRadius: 9, background: 'var(--theme-elevation-1000, #141413)', color: 'var(--theme-elevation-0, #fff)', padding: '.55rem 1rem', cursor: 'pointer' },
  applyOff: { opacity: .45, cursor: 'not-allowed' },
}
