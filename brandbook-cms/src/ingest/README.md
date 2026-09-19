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
