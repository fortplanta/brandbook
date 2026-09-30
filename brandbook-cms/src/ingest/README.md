# Ingest engine

The brain behind the "drop stuff in and it fills the right fields" flow. One
deterministic, dependency-free module (`classify.js`) that every input channel
shares. No network, no model, no guessing at prose.

## What it does

`classify(items)` takes a flat list of injected items and returns **Detections** —
each says which `Profile` field the content maps to, how confident, and (for
prose it can't place) which fields it *could* go to, for the human to pick.

```js
import { classify, groupByTarget } from './classify.js'

classify([
  { type: 'text', text: 'Signal #0B78DE' },        // → colors (named "Signal")
  { type: 'file', name: 'wordmark.svg' },           // → logos
  { type: 'file', name: 'GeneralSans-Bold.otf' },   // → typography (family "General Sans", weight "Bold")
  { type: 'file', name: 'reel.mp4' },               // → motion
  { type: 'file', name: 'brand-assets.zip' },       // → downloadAll
  { type: 'text', text: 'We partner with companies…' }, // → null target + choices (you place it)
])
```

Routing rules (all deterministic):

| Input | Routes to |
|---|---|
| `#hex`, `rgb(…)`, `Name #hex`, multi-line palettes | `colors` (keeps names) |
| CSS `--color-x: #hex` / `--font-x: stack` | `colors` / `typography` |
| JSON `{ color:{…}, font:{…} }` | `colors` + `typography` |
| `.svg` (mark-ish name) / raster named "logo" | `logos` |
| `.png .jpg .webp …` | `imagery` |
| `.otf .ttf .woff .woff2` | `typography` (+ family/weight parsed from filename) |
| `.mp4 .webm .mov` | `motion` |
| `.zip` named brand-assets/all | `downloadAll`; other zips → `downloads` |
| `.pdf .ai .eps …` | `downloads` |
| **prose** | `null` → "needs your choice" (`tagline` / `platform` / `tone.boilerplate` / `coverNote`) |

**Prose is never guessed.** A pasted paragraph carries no signal for whether it's
the tagline, a platform block, or boilerplate — so the engine refuses to guess and
hands it to a required "you pick" control. The confirm step is the feature, not a
speed bump: it's what keeps auto-ingest from silently mis-filing.

## The three channels (thin clients on one engine)

- **Drag files from disk / click to browse** → `File` objects become `{type:'file', name, mime}` items.
- **Paste** → clipboard text becomes `{type:'text'}`, clipboard files become `{type:'file'}`. (This already covers copy-from-Figma.)
- **Figma marquee-select** (later) → a small Figma plugin walks the selection and emits the same items: paint fills → `text` hex, text nodes → `text`, exportable frames → `file` (SVG/PNG). It POSTs them to the CMS, which runs the *same* `classify()`.

## From "Apply" to a real write (Payload)

The prototype's **Apply** assembles a `Profile`-shaped patch with file *names* as
placeholders. In the Payload admin the same step does two things:

1. **Upload** each `File` to the `media` collection → get back a media id/URL.
2. **PATCH** the client document, setting each detection's target field, with the
   uploaded ids swapped in for the placeholder names.

Because the engine is pure and framework-free, the admin drop-zone component and
the Figma plugin call it unchanged — only the "gather items" and "apply" ends differ.

## Tested

`classify.test.mjs` — run `node src/ingest/classify.test.mjs`. Covers hex/named/
multi-line colours, CSS + JSON tokens, svg/raster/font/mp4/zip routing, font-family
parsing, and the prose-stays-unplaced guarantee.

## Image analysis — local, open source (`vision.js`)

Exported names are often `img2.png`, so raster images are also **looked at**.
Everything runs on the CMS server — no external service, images never leave it:

- **CLIP** (`Xenova/clip-vit-base-patch16`, ONNX via `@huggingface/transformers`,
  CPU). Downloaded once (~150 MB) into `.cache/models` on first use; set
  `VISION_CACHE_DIR` to put it elsewhere. Warm-up happens when the drop zone
  opens; then ~130 ms per image.
- **Pixel signals** (sharp): transparency, dominant colours, and coverage by the
  **client's own palette** (their saved colours + any colours dropped in the
  same batch).
- **Rules** where pixels beat the model: a transparent cut-out → logo; flat
  artwork built from 2+ distinct palette colours → *Färg i bruk* — unless it's a
  compact mark in the middle of one brand colour → logo.

| Category | Routes to |
|---|---|
| Logotyp | `logos` |
| Färg i bruk | `colorInUse` (+ which palette colours it uses) |
| Digitalt / Print / Miljö / Profilprodukter | `applications` (with `kind`) |
| Grafiska element | `graphics` |
| Bildspråk (photo) | `imagery` |

**Videos** are judged too — the drop zone grabs four frames (30–97 % through,
since logo animations often start blank) and `analyzeFrames` averages them,
skipping near-empty frames. A logo animation routes to Logotyp, palette artwork
to Färg i bruk, a mockup to Tillämpning, and filmed footage to **Rörligt (film)**
(`motion`). Formats the browser can't decode (e.g. some `.mov`) keep the
file-type guess (Motion) and say so.

**Key visual** (key **0**) — the brandbook hero, an image or a video. Never
auto-assigned (it's a taste call), and single: choosing a new one sends the
previous item back to what the analysis said. Saved to the client's `keyVisual`
field; the site maps it to the cover background (`cover.background`), where a
video plays behind the title with the cover's parallax.

**Confidence → behaviour.** `high`/`med` route themselves; `low` lands in
"Needs your choice" with the top two suggestions as one-click buttons. Keyboard
triage in the panel: ↑/↓ move, **1–9** set a category, **Enter** takes the first
suggestion, **Space** previews, **⌫** removes.

**Preview.** Thumbnails open a large preview (click, Space, or "Granska alla" /
"Granska flaggade"): the image or playing video, the verdict with *why* (rule or
model, confidence, top-3 scores) and the palette colours found, plus the
category buttons. ←/→ step through every item — so flagged items get decided
and auto-sorted ones get double-checked in the same flow; picking a category
jumps to the next item. After Apply, the Media list shows category, palette
colours and "auto-tagged" as columns.

**On Apply** analysed images are renamed `{client-slug}-{category}-{nn}.{ext}`
(numbering continues per category), captioned by category when the export name
is meaningless (`img2`, `IMG_4032`, `Screenshot … at …`, `Frame 12`…), and the
Media doc stores `category`, `paletteColors`, `autoTagged` and an alt text like
"Färg i bruk — Sand, Navy".

**Measured** on a 31-image set (openly licensed Wikimedia photos of print,
signage, merch and screens; generated logos and palette posters; random photos),
with the client palette supplied: 26/31 correct. Confidence is the useful part —
`high` 22 right / 2 wrong (both defensible: a logo close-up on a t-shirt, a
brandbook page screenshot), `med` 3/0, `low` 1/3 → exactly the ones sent to you.
Model comparison on the same set: CLIP B/32 20/31, CLIP B/16 25/31, SigLIP-base
25/31 at 4× the time — B/16 + the pixel rules won.
