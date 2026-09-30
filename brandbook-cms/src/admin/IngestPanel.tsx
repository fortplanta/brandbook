'use client'
/* ============================================================================
   INGEST PANEL — the "drop stuff in and it fills the fields" component, mounted
   at the top of the Clients edit view. Drop or paste content → the shared engine
   detects and routes it → you confirm/re-route, place any prose → Apply uploads
   files to Media and saves the client as a DRAFT. Review the populated fields,
   then Publish. Same engine as the standalone prototype and the future Figma
   plugin; only the "apply" end is real here.

   Images are also LOOKED AT (local, open-source — src/ingest/vision.js): each
   raster gets a category (logo, colour in use, digital/print/environment/merch
   application, graphics, photo) from its pixels + the client's palette, since
   exported names are often "img2.png". Confident results route themselves;
   uncertain ones wait in "Needs your choice" with suggestions. Videos are judged
   from four frames (a logo animation belongs with the logos, not "Motion").
   Keyboard triage: ↑/↓ move, 0–9 set a category (0 = key visual), Enter accepts the first
   suggestion, Space opens the preview, ⌫ removes. The preview (click a thumbnail
   or "Granska alla") shows the item large — videos play — with ←/→ to step
   through everything, so flagged items AND auto-sorted ones can be checked.
   ========================================================================== */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { classify, groupByTarget, TARGETS } from '../ingest/classify.js'
import { applyIngest } from '../ingest/applyPatch.js'

type Detection = any
const TARGET_KEYS = Object.keys(TARGETS)

const GLYPH: Record<string, string> = { font: 'Aa', motion: '►', download: '⤓', downloadAll: '⤓', logo: '◆', image: '▣', text: '¶' }

/* Image categories (keys match src/ingest/vision.js) → target field (+ kind). Order = keyboard 1–8. */
const CATS: { key: string; label: string; target: string; kind?: string }[] = [
  { key: 'logo', label: 'Logotyp', target: 'logos' },
  { key: 'color', label: 'Färg i bruk', target: 'colorInUse' },
  { key: 'digital', label: 'Digitalt', target: 'applications', kind: 'digital' },
  { key: 'print', label: 'Print', target: 'applications', kind: 'print' },
  { key: 'environment', label: 'Miljö', target: 'applications', kind: 'environment' },
  { key: 'merch', label: 'Profilprodukter', target: 'applications', kind: 'merch' },
  { key: 'graphics', label: 'Grafiska element', target: 'graphics' },
  { key: 'photo', label: 'Bildspråk', target: 'imagery' },
  { key: 'motion', label: 'Rörligt (film)', target: 'motion' },   // videos only
]
/* Key visual — the brandbook hero (image or video). One per client, always a
   human decision (never auto-assigned), on key 0. Every pickable category with
   its hotkey, in display order: */
const ALL = [
  { key: 'keyvisual', label: 'Key visual', target: 'keyVisual', kind: undefined as string | undefined, hot: '0' },
  ...CATS.map((c, i) => ({ ...c, hot: String(i + 1) })),
]
const CAT = Object.fromEntries(ALL.map((c) => [c.key, c]))
const byHotkey = (k: string) => ALL.find((c) => c.hot === k)

/* Export names that carry no meaning — their caption comes from the analysis instead. */
const GENERIC_NAME = /^(?:[\d\s_.-]+|(?:img|image|bild|photo|foto|pic|picture|screenshot|screen ?shot|skärmbild|skärmavbild|dsc|dcim|untitled|namnlös|frame|artboard|group|export)[\s_-]*[\d\s_.:-]*(?:(?:at|kl\.?)[\s\d_.:-]*)?)$/i

/** Four frames from across a video (30–97%: logo animations often start blank),
    plus a poster frame for the thumbnail. Browser-decodable formats only. */
async function videoFrames(file: File): Promise<{ frames: string[]; poster: string }> {
  const v = document.createElement('video')
  v.muted = true; v.preload = 'auto'; v.src = URL.createObjectURL(file)
  const once = (ev: string) => new Promise<void>((ok, fail) => {
    const t = setTimeout(() => fail(new Error('video timed out')), 15000)
    v.addEventListener(ev, () => { clearTimeout(t); ok() }, { once: true })
    v.addEventListener('error', () => { clearTimeout(t); fail(new Error('kunde inte läsa videon (format?)')) }, { once: true })
  })
  await once('loadeddata')
  const c = document.createElement('canvas')
  const k = Math.min(1, 448 / Math.max(v.videoWidth, v.videoHeight))
  c.width = Math.max(1, Math.round(v.videoWidth * k)); c.height = Math.max(1, Math.round(v.videoHeight * k))
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const frames: string[] = []
  let poster = '', best = -1
  for (const t of [0.3, 0.55, 0.8, 0.97]) {
    v.currentTime = Math.min(v.duration - 0.05, t * v.duration); await once('seeked')
    ctx.drawImage(v, 0, 0, c.width, c.height)
    const url = c.toDataURL('image/png'); frames.push(url)
    // poster = the busiest frame (a blank/black moment makes a useless thumbnail)
    const px = ctx.getImageData(0, 0, c.width, c.height).data
    let sum = 0, sq = 0, n = 0
    for (let i = 0; i < px.length; i += 4 * 37) { const l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11; sum += l; sq += l * l; n++ }
    const variance = sq / n - (sum / n) ** 2
    if (variance > best) { best = variance; poster = url }
  }
  URL.revokeObjectURL(v.src)
  return { frames, poster }
}

/** A downscaled PNG copy for analysis (keeps transparency; the original uploads untouched). */
async function thumbDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 448 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k))
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  return c.toDataURL('image/png')
}

export const IngestPanel: React.FC = () => {
  const { id } = useDocumentInfo()
  const [dets, setDets] = useState<Detection[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [over, setOver] = useState(false)
  const fileFor = useRef<Map<string, File>>(new Map())
  const palette = useRef<{ name: string; hex: string }[]>([])
  const queue = useRef<Detection[]>([])
  const running = useRef(0)
  const detsRef = useRef<Detection[]>([])
  const [model, setModel] = useState<'loading' | 'ready' | 'error'>('loading')
  detsRef.current = dets

  const update = () => setDets((d) => [...d])

  // Load the model ahead of the first drop, and the client's palette for matching.
  useEffect(() => {
    fetch('/api/ingest/vision/warm', { credentials: 'include' })
      .then((r) => setModel(r.ok ? 'ready' : 'error')).catch(() => setModel('error'))
    if (id) fetch(`/api/clients/${id}?depth=0&draft=true`, { credentials: 'include' })
      .then((r) => r.json()).then((doc) => { palette.current = (doc?.colors || []).filter((c: any) => c?.hex).map((c: any) => ({ name: c.name || c.hex, hex: c.hex })) })
      .catch(() => {})
  }, [id])

  /** Set an image's category (and so its target field). */
  const setCategory = (d: Detection, key: string, byHand: boolean) => {
    const c = CAT[key]; if (!c) return
    if (key === 'motion' && !d.data?.video) return   // only videos can be "Rörligt"
    // only one key visual: the previous one goes back to what the analysis said
    if (key === 'keyvisual') for (const o of detsRef.current) {
      if (o === d || o.data?.category !== 'keyvisual') continue
      const back = o.ai?.status === 'done' && o.ai.confidence !== 'low' ? o.ai.category : null
      if (back) setCategory(o, back, false)
      else { o.target = null; o.data.category = undefined; o.data.byHand = false; o.suggest = o.ai?.ranked?.slice(0, 2).map(([k]: [string]) => k) }
    }
    d.data.category = key; d.data.kind = c.kind; d.target = c.target; d.data.byHand = byHand
    if (byHand) d.confidence = 'high'
    // "img2.png" says nothing — caption it by what it is instead
    const stem = String(d.data.file || '').replace(/\.[^.]+$/, '')
    if (GENERIC_NAME.test(stem) || d.data.captionFromCategory) { d.data.caption = c.label; d.data.name = c.label; d.data.captionFromCategory = true }
  }

  const analyze = async (d: Detection) => {
    d.ai = { status: 'pending' }; update()
    try {
      const f = fileFor.current.get(d.data.file)
      if (!f) throw new Error('file missing')
      // palette = the client's saved colours + any colours dropped in this batch
      const pal = [...palette.current]
      for (const x of detsRef.current) if (x.kind === 'color' && x.data?.hex) pal.push({ name: x.data.name || x.data.hex, hex: x.data.hex })
      let body: any
      if (d.data.video) { const v = await videoFrames(f); d.data.poster = v.poster; update(); body = { images: v.frames, palette: pal } }
      else body = { image: await thumbDataUrl(f), palette: pal }
      const res = await fetch('/api/ingest/vision', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const r = await res.json()
      if (!res.ok) throw new Error(r?.error || `HTTP ${res.status}`)
      // for a video, "a photograph of a scene" means film → Rörligt
      const asCat = (k: string) => (d.data.video && k === 'photo' ? 'motion' : k)
      d.ai = { status: 'done', ...r, category: asCat(r.category), ranked: r.ranked.map(([k, v]: [string, number]) => [asCat(k), v]) }
      d.data.paletteNames = (r.signals?.paletteMatches || []).slice(0, 3).map((p: any) => p.name).join(', ') || undefined
      if (!d.data.byHand) {
        if (r.confidence === 'low') { d.target = null; d.data.category = undefined; d.suggest = d.ai.ranked.slice(0, 2).map(([k]: [string]) => k) }
        else { setCategory(d, d.ai.category, false); d.confidence = r.confidence }
      }
    } catch (e: any) {
      d.ai = { status: 'error', error: e?.message || String(e) }   // keeps its filename-based guess
    }
    update()
  }
  const pump = () => {
    while (running.current < 2 && queue.current.length) {
      const d = queue.current.shift()!
      running.current++
      analyze(d).finally(() => { running.current--; pump() })
    }
  }

  const addItems = (items: any[]) => {
    if (!items.length) return
    const fresh: Detection[] = classify(items)
    for (const d of fresh) {   // one object URL per file, for thumbnails + the preview
      const f = d.data?.file && fileFor.current.get(d.data.file)
      if (f && /^(image|video)\//.test(f.type)) d.data.previewUrl = URL.createObjectURL(f)
    }
    for (const d of fresh) if (d.data?.analyze && fileFor.current.has(d.data.file)) { d.ai = { status: 'queued' }; queue.current.push(d) }
    setDets((d) => [...d, ...fresh])
    setMsg(null)
    setTimeout(pump, 0)
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
  const analysing = dets.filter((d) => d.ai?.status === 'pending' || d.ai?.status === 'queued').length
  const analysed = dets.filter((d) => d.ai?.status === 'done').length
  const hasImages = dets.some((d) => d.data?.analyze)

  // Keyboard triage on rows: ↑/↓ move, 1–8 category, Enter accept suggestion, ⌫ remove.
  const onRowKey = (e: React.KeyboardEvent, d: Detection) => {
    if ((e.target as HTMLElement).closest('input, select, button')) return
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-ingest-row]'))
    const i = rows.indexOf(e.currentTarget as HTMLElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); rows[i + (e.key === 'ArrowDown' ? 1 : -1)]?.focus(); return }
    if (e.key === ' ' && d.data?.previewUrl) { e.preventDefault(); openPreview(d); return }
    if (!d.data?.analyze) return
    const n = Number(e.key)
    const hit = byHotkey(e.key)
    if (hit && !(hit.key === 'motion' && !d.data.video)) { e.preventDefault(); setCategory(d, hit.key, true); update(); setTimeout(() => rows[i + 1]?.focus(), 0) }
    else if (e.key === 'Enter' && !d.target && d.suggest?.[0]) { e.preventDefault(); setCategory(d, d.suggest[0], true); update() }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); setDets((x) => x.filter((y) => y !== d)); setTimeout(() => (rows[i + 1] ?? rows[i - 1])?.focus(), 0) }
  }
  /* ---- preview (lightbox) ------------------------------------------------ */
  const [previewId, setPreviewId] = useState<string | null>(null)
  const media = dets.filter((d) => d.data?.previewUrl)
  const pIndex = media.findIndex((d) => d.id === previewId)
  const pd = pIndex >= 0 ? media[pIndex] : null
  const openPreview = (d: Detection) => setPreviewId(d.id)
  const step = (dir: number) => { if (!media.length) return; const i = (pIndex + dir + media.length) % media.length; setPreviewId(media[i].id) }
  useEffect(() => {
    if (!pd) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setPreviewId(null) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
      else if (e.key === 'Enter' && !pd.target && pd.suggest?.[0]) { e.preventDefault(); setCategory(pd, pd.suggest[0], true); update(); setTimeout(() => step(1), 180) }
      else if ((e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); const next = media[pIndex + 1] ?? media[pIndex - 1]; setDets((x) => x.filter((y) => y !== pd)); setPreviewId(next && next !== pd ? next.id : null) }
      else if (pd.data?.analyze) {
        const n = Number(e.key)
        const hit = byHotkey(e.key)
        if (hit && !(hit.key === 'motion' && !pd.data.video)) { e.preventDefault(); setCategory(pd, hit.key, true); update(); setTimeout(() => step(1), 180) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const firstFlagged = media.find((d) => !d.target)

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
    if (d.data?.previewUrl) {
      const src = d.data.video ? d.data.poster : d.data.previewUrl
      return (
        <button type="button" style={S.thumbBtn} title="Förhandsgranska (mellanslag)" onClick={() => openPreview(d)}>
          {src ? <img alt="" src={src} style={S.thumb} /> : <span style={{ ...S.glyph, ...S.thumb }}>►</span>}
          {d.data.video && <span style={S.play}>▶</span>}
        </button>
      )
    }
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
            <span style={S.muted}>
              {dets.length} detected
              {hasImages && <> · bilder: {analysing ? `analyserar ${analysed}/${analysed + analysing}…` : `${analysed} analyserade`}{model === 'loading' && analysing ? ' (laddar modellen första gången)' : ''}{model === 'error' ? ' · bildanalys ej tillgänglig' : ''}</>}
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              {firstFlagged && <button type="button" style={{ ...S.ghost, border: '1px solid #e5a99e' }} onClick={() => openPreview(firstFlagged)}>Granska flaggade</button>}
              {media.length > 0 && <button type="button" style={S.ghost} onClick={() => openPreview(media[0])}>Granska alla ({media.length})</button>}
              <button type="button" style={S.ghost} onClick={() => { setDets([]); fileFor.current.clear(); setMsg(null) }}>Clear all</button>
            </span>
          </div>

          {hasImages && (
            <div style={S.keys}>
              Tangentbord: <kbd style={S.kbd}>↑</kbd><kbd style={S.kbd}>↓</kbd> flytta · {ALL.map((c) => <span key={c.key}><kbd style={S.kbd}>{c.hot}</kbd> {c.label}{'  '}</span>)}· <kbd style={S.kbd}>⏎</kbd> ta förslaget · <kbd style={S.kbd}>mellanslag</kbd> förhandsgranska
            </div>
          )}

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
                  <div key={d.id} style={{ ...S.row, ...(d.target ? null : S.rowNeeds) }} data-ingest-row tabIndex={0} onKeyDown={(e) => onRowKey(e, d)}>
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
                        {d.data?.analyze && (d.ai?.status === 'queued' || d.ai?.status === 'pending') && <span style={S.tag}>analyserar…</span>}
                        {d.data?.analyze && d.data.category && <span style={{ ...S.tag, ...S.tagCat }} title={d.ai?.reason === 'model' ? `modellen, marginal ${d.ai?.margin}` : d.ai?.reason}>{CAT[d.data.category]?.label}{d.data.byHand ? ' · manuellt' : ''}</span>}
                        {d.data?.paletteNames && <span style={S.tag}>{d.data.paletteNames}</span>}
                        {d.data?.analyze && !d.target && d.suggest?.map((k: string, j: number) => (
                          <button key={k} type="button" style={S.suggest} onClick={() => { setCategory(d, k, true); update() }}>{j === 0 ? 'Förslag: ' : 'eller '}{CAT[k]?.label}</button>
                        ))}
                        {d.ai?.status === 'error' && <span style={{ ...S.tag, color: '#c8452f' }} title={d.ai.error}>analys misslyckades — namnbaserad gissning</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>
                      {d.data?.analyze ? (
                        <select style={{ ...S.route, ...(d.target ? null : { border: '1px solid #c8452f' }) }} value={d.data.category || ''} onChange={(e) => { if (e.target.value) setCategory(d, e.target.value, true); update() }}>
                          {!d.data.category && <option value="">— välj kategori —</option>}
                          {ALL.map((c) => (c.key === 'motion' && !d.data.video) ? null : <option key={c.key} value={c.key}>{c.hot}. {c.label}</option>)}
                        </select>
                      ) : (
                        <select style={{ ...S.route, ...(d.target ? null : { border: '1px solid #c8452f' }) }} value={d.target || ''} onChange={(e) => { d.target = e.target.value || null; update() }}>
                          {!d.target && <option value="">— choose a field —</option>}
                          {TARGET_KEYS.map((k) => <option key={k} value={k}>{(TARGETS as any)[k].label}</option>)}
                        </select>
                      )}
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
            <button type="button" onClick={apply} disabled={busy || unresolved || analysing > 0 || dets.length === 0} style={{ ...S.apply, ...(busy || unresolved || analysing > 0 || !dets.length ? S.applyOff : null) }}>
              {busy ? 'Applying…' : analysing ? 'Analyserar bilder…' : unresolved ? 'Resolve the highlighted items first' : `Apply → ${dets.length} field${dets.length === 1 ? '' : 's'} (draft)`}
            </button>
          </div>
        </div>
      )}
      {pd && (
        <div style={S.lbWrap} role="dialog" aria-modal="true" aria-label="Förhandsgranskning" onClick={() => setPreviewId(null)}>
          <div style={S.lb} onClick={(e) => e.stopPropagation()}>
            <div style={S.lbStage}>
              <button type="button" style={{ ...S.lbNav, left: 12 }} onClick={() => step(-1)} aria-label="Föregående (←)">‹</button>
              {pd.data.video
                ? <video key={pd.id} src={pd.data.previewUrl} controls autoPlay muted loop playsInline style={S.lbMedia} />
                : <img key={pd.id} src={pd.data.previewUrl} alt="" style={{ ...S.lbMedia, ...S.lbChecker }} />}
              <button type="button" style={{ ...S.lbNav, right: 12 }} onClick={() => step(1)} aria-label="Nästa (→)">›</button>
            </div>
            <div style={S.lbSide}>
              <div style={S.muted}>{pIndex + 1} / {media.length}</div>
              <div style={{ fontWeight: 600, fontSize: 15, wordBreak: 'break-all' }}>{pd.data.file}</div>
              <div>
                {pd.target
                  ? <span style={{ ...S.tag, ...S.tagCat }}>{pd.data.category ? CAT[pd.data.category]?.label : (TARGETS as any)[pd.target]?.label}{pd.data.byHand ? ' · manuellt' : ''}</span>
                  : <span style={{ ...S.tag, color: '#c8452f', border: '1px solid #e5a99e' }}>Behöver ditt val</span>}
              </div>
              {pd.ai?.status === 'done' && (
                <div style={S.lbWhy}>
                  <div style={S.muted}>Varför: {pd.ai.reason === 'model' ? 'modellens bedömning' : pd.ai.reason} · säkerhet {pd.ai.confidence === 'high' ? 'hög' : pd.ai.confidence === 'med' ? 'medel' : 'låg'}</div>
                  {pd.ai.ranked.map(([k, v]: [string, number]) => (
                    <div key={k} style={S.bar2}><span style={{ width: 118 }}>{CAT[k]?.label}</span><span style={S.barTrack}><span style={{ ...S.barFill, width: `${Math.round(v * 100)}%` }} /></span><span style={S.muted}>{Math.round(v * 100)}%</span></div>
                  ))}
                  {pd.data.paletteNames && <div style={S.muted}>Palettfärger: {pd.data.paletteNames}</div>}
                </div>
              )}
              {pd.ai?.status === 'pending' || pd.ai?.status === 'queued' ? <div style={S.muted}>Analyserar…</div> : null}
              {pd.data?.analyze && (
                <div style={S.lbCats}>
                  {ALL.map((c) => (c.key === 'motion' && !pd.data.video) ? null : (
                    <button key={c.key} type="button" onClick={() => { setCategory(pd, c.key, true); update() }}
                      style={{ ...S.lbCat, ...(pd.data.category === c.key ? S.lbCatOn : null), ...(!pd.target && pd.suggest?.includes(c.key) ? S.lbCatSuggest : null) }}>
                      <kbd style={S.kbd}>{c.hot}</kbd> {c.label}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ ...S.muted, marginTop: 'auto', lineHeight: 1.7 }}>
                <kbd style={S.kbd}>←</kbd><kbd style={S.kbd}>→</kbd> bläddra · <kbd style={S.kbd}>0–9</kbd> kategori (hoppar vidare) · <kbd style={S.kbd}>⏎</kbd> ta förslaget · <kbd style={S.kbd}>⌫</kbd> ta bort · <kbd style={S.kbd}>esc</kbd> stäng
              </div>
            </div>
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
  thumb: { width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--theme-elevation-150,#e6e6e2)', flex: 'none', display: 'block', background: 'repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0 / 12px 12px' },
  thumbBtn: { position: 'relative', flex: 'none', padding: 0, border: 0, background: 'none', cursor: 'zoom-in', borderRadius: 8 },
  play: { position: 'absolute', right: 4, bottom: 4, fontSize: 10, lineHeight: 1, color: '#fff', background: 'rgba(0,0,0,.6)', borderRadius: 4, padding: '2px 4px' },
  lbWrap: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,10,12,.72)', display: 'grid', placeItems: 'center', padding: 24 },
  lb: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', width: 'min(1400px, 100%)', height: 'min(860px, 100%)', background: 'var(--theme-elevation-0,#fff)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 30px 80px -30px rgba(0,0,0,.6)' },
  lbStage: { position: 'relative', display: 'grid', placeItems: 'center', background: 'var(--theme-elevation-100,#1a1a1c)', minHeight: 0, padding: 24 },
  lbMedia: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6 },
  lbChecker: { background: 'repeating-conic-gradient(#e9e9e9 0 25%, #fff 0 50%) 0 0 / 16px 16px' },
  lbNav: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: 999, border: 0, background: 'rgba(255,255,255,.9)', color: '#111', fontSize: 24, lineHeight: 1, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.25)' },
  lbSide: { display: 'flex', flexDirection: 'column', gap: 12, padding: 20, overflowY: 'auto', borderLeft: '1px solid var(--theme-elevation-150,#e6e6e2)' },
  lbWhy: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 },
  bar2: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, background: 'var(--theme-elevation-100,#eee)', overflow: 'hidden' },
  barFill: { display: 'block', height: '100%', background: 'var(--theme-elevation-800,#333)' },
  lbCats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  lbCat: { font: 'inherit', fontSize: 12.5, textAlign: 'left', border: '1px solid var(--theme-elevation-150,#e6e6e2)', background: 'var(--theme-elevation-0,#fff)', color: 'inherit', borderRadius: 8, padding: '.4rem .5rem', cursor: 'pointer' },
  lbCatOn: { background: 'var(--theme-elevation-1000,#141413)', color: 'var(--theme-elevation-0,#fff)', border: '1px solid transparent' },
  lbCatSuggest: { border: '1px solid #e5a99e', boxShadow: 'inset 0 0 0 1px #e5a99e' },
  glyph: { width: 32, height: 32, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--theme-elevation-50,#f5f5f3)', border: '1px solid var(--theme-elevation-150,#e6e6e2)', color: 'var(--theme-elevation-500,#6f6f76)', flex: 'none', fontSize: 14 },
  label: { fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  edit: { font: 'inherit', fontSize: 13, border: '1px solid var(--theme-elevation-150,#e6e6e2)', background: 'var(--theme-elevation-50,#f5f5f3)', color: 'inherit', borderRadius: 6, padding: '.15rem .4rem', width: 140 },
  tag: { fontSize: 11, color: 'var(--theme-elevation-500,#6f6f76)', background: 'var(--theme-elevation-50,#f5f5f3)', border: '1px solid var(--theme-elevation-150,#e6e6e2)', borderRadius: 999, padding: '.05rem .45rem' },
  route: { font: 'inherit', fontSize: 13, border: '1px solid var(--theme-elevation-150,#e6e6e2)', background: 'var(--theme-elevation-0,#fff)', color: 'inherit', borderRadius: 7, padding: '.2rem .4rem', maxWidth: 170 },
  conf: { width: 7, height: 7, borderRadius: '50%', flex: 'none' },
  rm: { border: 0, background: 'none', color: 'var(--theme-elevation-500,#6f6f76)', fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '0 4px' },
  apply: { font: 'inherit', fontWeight: 600, fontSize: 14, border: 0, borderRadius: 9, background: 'var(--theme-elevation-1000, #141413)', color: 'var(--theme-elevation-0, #fff)', padding: '.55rem 1rem', cursor: 'pointer' },
  applyOff: { opacity: .45, cursor: 'not-allowed' },
  tagCat: { color: 'var(--theme-elevation-1000,#141413)', fontWeight: 600 },
  suggest: { font: 'inherit', fontSize: 12, border: '1px solid #e5a99e', background: 'var(--theme-elevation-0,#fff)', color: 'inherit', borderRadius: 999, padding: '.1rem .55rem', cursor: 'pointer' },
  keys: { fontSize: 12, color: 'var(--theme-elevation-500,#6f6f76)', margin: '0 0 8px', lineHeight: 2 },
  kbd: { font: '11px ui-monospace, monospace', border: '1px solid var(--theme-elevation-150,#e6e6e2)', borderBottomWidth: 2, borderRadius: 4, padding: '0 .3rem', margin: '0 .15rem', background: 'var(--theme-elevation-0,#fff)', color: 'var(--theme-elevation-800,#333)' },
}
