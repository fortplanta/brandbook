/* ============================================================================
   VISION — local, open-source image understanding for the ingest drop zone.
   Nothing leaves the server: a CLIP model (openai/clip-vit-base-patch16, ONNX via
   transformers.js, ~150 MB, downloaded once into .cache/models) plus cheap pixel
   signals computed with sharp. Answers "what is this image, for a brandbook?"
   for files named image1.png.

   Pipeline, cheapest first:
     1. Pixel signals (sharp): transparency, dominant colours, and how much of
        the image is covered by the CLIENT'S OWN palette.
     2. CLIP zero-shot: similarity to a few descriptive prompts per category.
     3. Rules that combine them — e.g. "flat and mostly 2+ palette colours" is a
        colour application even when CLIP thinks it's a logo (its main confusion).
   The result carries a confidence from the margin between the top two
   categories; the drop zone auto-routes confident results and asks the human
   about the rest. Measured on a 31-image test set: see src/ingest/README.md.
   ========================================================================== */
import sharp from 'sharp'

/** Brandbook categories → where the ingest routes them + the CLIP prompts. */
export const CATEGORIES = {
  logo:        { target: 'logos',        label: 'Logotyp',         prompts: ['a logo', 'a company logo on a plain background', 'a wordmark logo', 'a simple brand symbol'] },
  color:       { target: 'colorInUse',   label: 'Färg i bruk',     prompts: ['a flat graphic design with bold solid colours and large text', 'a colourful typographic poster design', 'a minimal graphic layout with blocks of colour'] },
  digital:     { target: 'applications', label: 'Digitalt',        kind: 'digital',     prompts: ['a screenshot of a website', 'a user interface of an app', 'a website shown on a laptop screen'] },
  print:       { target: 'applications', label: 'Print',           kind: 'print',       prompts: ['printed business cards', 'printed stationery and letterhead', 'a printed poster or brochure'] },
  environment: { target: 'applications', label: 'Miljö',           kind: 'environment', prompts: ['a billboard', 'a shop sign on a building', 'signage and advertising in a city street'] },
  merch:       { target: 'applications', label: 'Profilprodukter', kind: 'merch',       prompts: ['a branded t-shirt', 'a tote bag', 'a mug with a logo', 'branded merchandise'] },
  graphics:    { target: 'graphics',     label: 'Grafiska element', prompts: ['a set of icons', 'a repeating pattern', 'an abstract texture'] },
  photo:       { target: 'imagery',      label: 'Bildspråk',       prompts: ['a photograph of a landscape', 'a photograph of people', 'a photograph of a city', 'a lifestyle photograph'] },
}

const MODEL = 'Xenova/clip-vit-base-patch16'
const PROMPTS = Object.values(CATEGORIES).flatMap((c) => c.prompts)
const CAT_OF = Object.fromEntries(Object.entries(CATEGORIES).flatMap(([k, c]) => c.prompts.map((p) => [p, k])))

/* ---- model: one lazy singleton per server process ---------------------- */
let clfPromise = null
async function classifier() {
  if (!clfPromise) {
    clfPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      env.cacheDir = process.env.VISION_CACHE_DIR || `${process.cwd()}/.cache/models`
      return pipeline('zero-shot-image-classification', MODEL, { dtype: 'q8' })
    })().catch((e) => { clfPromise = null; throw e })
  }
  return clfPromise
}
/** Start loading the model early (first load downloads it; later ones take ~1s). */
export const warmUp = () => classifier().then(() => true)

/* ---- pixel signals ----------------------------------------------------- */
const hexToRgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
// perceptual-ish RGB distance ("redmean") — good enough to say "this is Signal"
const dist = ([r1, g1, b1], [r2, g2, b2]) => { const rm = (r1 + r2) / 2; const dr = r1 - r2, dg = g1 - g2, db = b1 - b2; return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) }

async function pixelSignals(buffer, palette) {
  const { data, info } = await sharp(buffer).resize(96, 96, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const n = info.width * info.height
  const pal = palette.map((c) => ({ ...c, rgb: hexToRgb(c.hex), count: 0 }))
  const buckets = new Map()
  let transparent = 0, opaque = 0
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 200) { transparent++; continue }
    opaque++
    const px = [data[i], data[i + 1], data[i + 2]]
    const key = (px[0] >> 4) << 8 | (px[1] >> 4) << 4 | (px[2] >> 4)
    const b = buckets.get(key) || { r: 0, g: 0, b: 0, c: 0 }
    b.r += px[0]; b.g += px[1]; b.b += px[2]; b.c++; buckets.set(key, b)
    let best = null, bd = 60
    for (const p of pal) { const d = dist(px, p.rgb); if (d < bd) { bd = d; best = p } }
    if (best) best.count++
  }
  const colors = [...buckets.values()].sort((x, y) => y.c - x.c).slice(0, 6)
    .map((b) => ({ hex: toHex(b.r / b.c, b.g / b.c, b.b / b.c), share: +(b.c / Math.max(1, opaque)).toFixed(3) }))

  // Foreground spread: how much of the frame the "not background" pixels span
  // (2nd–98th percentile box, so stray pixels don't count). A logo is a compact
  // mark with margin around it; poster type and layouts spread across the frame.
  const bg = colors[0] ? hexToRgb(colors[0].hex) : [255, 255, 255]
  const xs = [], ys = []
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 200) continue
    if (dist([data[i], data[i + 1], data[i + 2]], bg) > 70) { xs.push(p % info.width); ys.push(Math.floor(p / info.width)) }
  }
  const pct = (a, q) => { if (!a.length) return 0; const s = [...a].sort((m, n) => m - n); return s[Math.min(s.length - 1, Math.floor(q * s.length))] }
  const spreadW = xs.length ? (pct(xs, 0.98) - pct(xs, 0.02) + 1) / info.width : 0
  const spreadH = ys.length ? (pct(ys, 0.98) - pct(ys, 0.02) + 1) / info.height : 0
  const paletteMatches = pal.filter((p) => p.count / Math.max(1, opaque) >= 0.015)
    .map((p) => ({ name: p.name, hex: p.hex, share: +(p.count / opaque).toFixed(3) }))
    .sort((a, b) => b.share - a.share)
  return {
    transparentShare: +(transparent / n).toFixed(3),
    colors,
    paletteMatches,
    paletteCoverage: +paletteMatches.reduce((s, p) => s + p.share, 0).toFixed(3),
    distinctColors: colors.filter((c) => c.share >= 0.02).length,
    fgSpread: +(spreadW * spreadH).toFixed(3),        // 0 = nothing, 1 = fills the frame
    fgShare: +(xs.length / Math.max(1, opaque)).toFixed(3),
  }
}

/* ---- analysis ---------------------------------------------------------- */
/**
 * @param {{ buffer: Buffer, palette?: {name:string, hex:string}[] }} input
 * @returns {Promise<{ category, target, kind?, label, confidence:'high'|'med'|'low', margin:number,
 *   ranked:[string,number][], signals:object, reason:string }>}
 */
export async function analyzeImage({ buffer, palette = [] }) {
  const signals = await pixelSignals(buffer, palette)

  // CLIP sees transparent images flattened on white, like a person would.
  const flat = await sharp(buffer).resize(448, 448, { fit: 'inside' }).flatten({ background: '#ffffff' }).png().toBuffer()
  const { RawImage } = await import('@huggingface/transformers')
  const img = await RawImage.fromBlob(new Blob([flat], { type: 'image/png' }))
  const out = await (await classifier())(img, PROMPTS)
  const scores = {}
  for (const o of out) { const c = CAT_OF[o.label]; scores[c] = (scores[c] || 0) + o.score }
  let ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  let reason = 'model'

  // Rules override the model where pixels are more reliable than CLIP.
  // 1. A real cut-out (a large transparent area) is a logo or mark.
  if (signals.transparentShare > 0.15) {
    ranked = force(ranked, 'logo'); reason = 'transparent background'
  } else if (signals.paletteCoverage >= 0.7 && signals.paletteMatches[0]?.share >= 0.35 && hasSecondBrandColour(signals.paletteMatches)
             && ['logo', 'color', 'digital', 'print', 'graphics'].includes(ranked[0][0])) {
    // 2. Flat artwork built from the client's palette: a compact mark in the
    //    middle is a logo on a colour field; anything spread across the frame
    //    (type, blocks, layouts) is a colour application.
    const names = signals.paletteMatches.slice(0, 3).map((p) => p.name).join(', ')
    if (signals.fgSpread < 0.3 && signals.fgShare < 0.25) { ranked = force(ranked, 'logo'); reason = `compact mark on a brand colour (${names})` }
    else { ranked = force(ranked, 'color'); reason = `artwork in palette colours (${names})` }
  }

  return result(ranked, signals, reason)
}

/** Shape the answer: winner, confidence from the margin over the runner-up. */
function result(ranked, signals, reason, extra = {}) {
  const [top, second] = ranked
  const margin = +(top[1] - (second?.[1] ?? 0)).toFixed(3)
  const confidence = (reason !== 'model' && !extra.video) || margin >= 0.35 ? 'high' : margin >= 0.2 ? 'med' : 'low'
  const cat = CATEGORIES[top[0]]
  return {
    category: top[0], target: cat.target, kind: cat.kind, label: cat.label,
    confidence, margin, ranked: ranked.slice(0, 3).map(([k, v]) => [k, +v.toFixed(3)]),
    scores: Object.fromEntries(ranked.map(([k, v]) => [k, +v.toFixed(4)])),
    signals, reason, ...extra,
  }
}

/**
 * A video, judged from a few frames grabbed across its length (the browser
 * does the grabbing). Near-empty frames — the blank start of a logo animation —
 * are skipped; the rest are averaged, so one odd frame can't decide.
 * @param {{ buffers: Buffer[], palette?: {name:string, hex:string}[] }} input
 */
export async function analyzeFrames({ buffers, palette = [] }) {
  const each = []
  for (const buffer of buffers) each.push(await analyzeImage({ buffer, palette }))
  const useful = each.filter((r) => r.signals.distinctColors > 1 || r.signals.fgShare > 0.01)
  const frames = useful.length ? useful : each
  const sum = {}
  for (const r of frames) for (const [k, v] of Object.entries(r.scores)) sum[k] = (sum[k] || 0) + v / frames.length
  const ranked = Object.entries(sum).sort((a, b) => b[1] - a[1])
  // palette colours seen in any frame (max share) — for the "uses Signal, Navy" note
  const pal = new Map()
  for (const r of frames) for (const m of r.signals.paletteMatches) pal.set(m.name, { ...m, share: Math.max(m.share, pal.get(m.name)?.share ?? 0) })
  const signals = { ...frames[Math.floor(frames.length / 2)].signals, paletteMatches: [...pal.values()].sort((a, b) => b.share - a.share) }
  const agree = frames.filter((r) => r.category === ranked[0][0]).length
  return result(ranked, signals, `video — ${agree} av ${frames.length} bildrutor`, { video: true, frames: frames.length })
}

/** A second palette colour that's clearly different from the dominant one — thin
    type in an accent colour counts; near-duplicates (Ink vs Black) don't. */
function hasSecondBrandColour(matches) {
  const [first, ...rest] = matches
  if (!first) return false
  return rest.some((m) => m.share >= 0.015 && dist(hexToRgb(m.hex), hexToRgb(first.hex)) > 90)
}

/** Make one category the clear winner (a rule decided), keeping the rest ordered. */
function force(ranked, cat) {
  const rest = ranked.filter(([k]) => k !== cat)
  const sum = rest.reduce((a, [, v]) => a + v, 0) || 1
  return [[cat, 0.7], ...rest.map(([k, v]) => [k, (v / sum) * 0.3])]
}

/** Add `amount` to one category's score and renormalise. */
function bump(ranked, cat, amount) {
  const m = Object.fromEntries(ranked)
  m[cat] = (m[cat] || 0) + amount
  const tot = Object.values(m).reduce((a, b) => a + b, 0)
  return Object.entries(m).map(([k, v]) => [k, v / tot]).sort((a, b) => b[1] - a[1])
}
