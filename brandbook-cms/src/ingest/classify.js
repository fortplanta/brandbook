/* ============================================================================
   INGEST ENGINE — deterministic content classifier/router.
   Input: injected items (a pasted string, or a file's name+mime). Output: a flat
   list of Detections, each saying which `Profile` field the content maps to,
   how confident, and — when it can't be sure (prose) — which fields it COULD be,
   for the human to pick. No dependencies, no network, no guessing at prose.

   Shared by every input channel: the drop zone (paste + drag files) and, later,
   the Figma marquee plugin (which converts a selection into these same items).
   Framework-free ESM so it runs in the browser prototype AND server-side.
   ========================================================================== */

/** Target fields in the Profile shape, with human labels for the confirm UI. */
export const TARGETS = {
  colors: { label: 'Colours' },
  logos: { label: 'Logos' },
  typography: { label: 'Typography' },
  imagery: { label: 'Imagery' },
  motion: { label: 'Motion' },
  downloads: { label: 'Downloads' },
  downloadAll: { label: 'Download-all ZIP' },
  tagline: { label: 'Tagline' },
  coverNote: { label: 'Cover note' },
  platform: { label: 'Platform block (Kärnan)' },
  'tone.boilerplate': { label: 'Boilerplate (Röst)' },
};

/** Fields a free block of prose could plausibly fill — the "you pick" choices. */
const PROSE_CHOICES = ['tagline', 'platform', 'tone.boilerplate', 'coverNote'].map((k) => ({
  key: k,
  label: TARGETS[k].label,
}));

const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
const RGB = /rgba?\(\s*\d{1,3}\s*[, ]\s*\d{1,3}\s*[, ]\s*\d{1,3}/g;

const ext = (name = '') => (name.split('.').pop() || '').toLowerCase();
const baseName = (name = '') => name.replace(/\.[^.]+$/, '');
const titleCase = (s) => s
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')   // split camelCase: GeneralSans → General Sans
  .replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/\b\w/g, (c) => c.toUpperCase());

let _id = 0;
const nextId = () => `d${++_id}`;

/* ---- colour extraction ------------------------------------------------- */

function normHex(h) {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return '#' + s.toUpperCase();
}

/** Pull every colour out of a text blob, keeping a name when the text supplies one. */
export function extractColors(text) {
  const out = [];
  const seen = new Set();

  // CSS custom properties: --color-signal: #0B78DE;  (name comes from the var)
  const cssVar = /--([a-z0-9-]*colou?r[a-z0-9-]*|[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/gi;
  let m;
  while ((m = cssVar.exec(text))) {
    const hex = m[2].startsWith('#') ? normHex(m[2]) : m[2];
    if (seen.has(hex)) continue;
    seen.add(hex);
    const name = titleCase(m[1].replace(/colou?r/gi, '').replace(/^-|-$/g, '') || 'Colour');
    out.push({ hex, name, role: undefined });
  }
  if (out.length) return out;

  // Line-oriented: "Signal #0B78DE", "#0B78DE Signal", "Signal 0B78DE"
  for (const rawLine of text.split(/[\n,;]+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const hexes = line.match(HEX);
    if (hexes) {
      for (const h of hexes) {
        const hex = normHex(h);
        if (seen.has(hex)) continue;
        seen.add(hex);
        const name = titleCase(line.replace(HEX, '').replace(RGB, '').replace(/[^a-zA-ZåäöÅÄÖ0-9\s-]/g, '').trim());
        out.push({ hex, name: name || undefined, role: undefined });
      }
    } else {
      const rgb = line.match(RGB);
      if (rgb) for (const r of rgb) { if (!seen.has(r)) { seen.add(r); out.push({ hex: r + ')', name: undefined }); } }
    }
  }
  return out;
}

/* ---- typography (font files) ------------------------------------------- */

const WEIGHTS = /(thin|extralight|ultralight|light|regular|book|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|variable|vf)/i;
const SERIF_HINT = /(serif|sectra|times|georgia|garamond|caslon|minion|freight)/i;

/** Guess a typeface family + stack + weight label from a font filename. */
export function fontFromFilename(name) {
  const stem = baseName(name);
  const weightMatch = stem.match(WEIGHTS);
  const weight = weightMatch ? titleCase(weightMatch[0]) : 'Regular';
  const family = titleCase(stem.replace(WEIGHTS, '').replace(/[-_]+$/, '')) || 'Untitled';
  const serif = SERIF_HINT.test(stem);
  const stack = `"${family}", ${serif ? 'Georgia, "Times New Roman", serif' : 'ui-sans-serif, system-ui, sans-serif'}`;
  return { family, stack, weight };
}

/* ---- file classification ----------------------------------------------- */

const LOGO_HINT = /(logo|wordmark|symbol|mark|lockup|brandmark|monogram|favicon|icon)/i;
const IMG_HINT = /(photo|image|img|bg|background|hero|mock|shot|cover|banner|scene)/i;
// Only the "everything" ZIP — deliberately strict so a single-deliverable zip
// like "presskit.zip" routes to downloads, not the download-all slot.
const ALL_HINT = /(brand[-_ ]?assets|all[-_ ]?assets|everything|complete[-_ ]?(?:kit|package|set|assets)|full[-_ ]?(?:kit|package|set|assets)|\balla\b)/i;

function classifyFile(name, mime = '') {
  const e = ext(name);
  const is = (...xs) => xs.includes(e);

  if (is('otf', 'ttf', 'woff', 'woff2') || /font/.test(mime)) {
    return { kind: 'font', target: 'typography', confidence: 'high', data: { file: name, mime, ...fontFromFilename(name) } };
  }
  if (is('mp4', 'webm', 'mov', 'm4v') || /^video\//.test(mime)) {
    return { kind: 'motion', target: 'motion', confidence: 'high', data: { file: name, mime, title: titleCase(baseName(name)) } };
  }
  if (is('svg')) {
    // SVGs are usually marks; a name that screams photo overrides.
    const logo = LOGO_HINT.test(name) || !IMG_HINT.test(name);
    return logo
      ? { kind: 'logo', target: 'logos', confidence: LOGO_HINT.test(name) ? 'high' : 'med', data: { file: name, mime, name: titleCase(baseName(name)) } }
      : { kind: 'image', target: 'imagery', confidence: 'med', data: { file: name, mime, caption: titleCase(baseName(name)) } };
  }
  if (is('png', 'jpg', 'jpeg', 'webp', 'gif', 'avif') || /^image\//.test(mime)) {
    // Raster is usually imagery; a "logo" in the name reroutes to logos.
    return LOGO_HINT.test(name)
      ? { kind: 'logo', target: 'logos', confidence: 'med', data: { file: name, mime, name: titleCase(baseName(name)) } }
      : { kind: 'image', target: 'imagery', confidence: 'high', data: { file: name, mime, caption: titleCase(baseName(name)) } };
  }
  if (is('zip')) {
    return ALL_HINT.test(name)
      ? { kind: 'downloadAll', target: 'downloadAll', confidence: 'high', data: { file: name, mime } }
      : { kind: 'download', target: 'downloads', confidence: 'med', data: { file: name, mime, label: titleCase(baseName(name)) } };
  }
  if (is('pdf', 'ai', 'eps', 'indd', 'sketch', 'aep')) {
    return { kind: 'download', target: 'downloads', confidence: 'high', data: { file: name, mime, label: titleCase(baseName(name)) } };
  }
  // Unknown → offer as a generic download.
  return { kind: 'download', target: 'downloads', confidence: 'low', data: { file: name, mime, label: titleCase(baseName(name)) } };
}

/* ---- text classification ----------------------------------------------- */

function looksLikeJsonTokens(text) {
  const t = text.trim();
  if (!(t.startsWith('{') && t.endsWith('}'))) return null;
  try { return JSON.parse(t); } catch { return null; }
}

function classifyText(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1) JSON token object: { color: {...}, font: {...} }
  const json = looksLikeJsonTokens(trimmed);
  if (json) {
    const dets = [];
    const colorObj = json.color || json.colors || json.colours;
    if (colorObj && typeof colorObj === 'object') {
      for (const [k, v] of Object.entries(colorObj)) {
        if (typeof v === 'string' && v.match(HEX)) dets.push(colorDetection({ hex: normHex(v.match(HEX)[0]), name: titleCase(k) }, 'high', 'json'));
      }
    }
    const fontObj = json.font || json.fonts || json.fontFamily;
    if (fontObj && typeof fontObj === 'object') {
      for (const [k, v] of Object.entries(fontObj)) {
        if (typeof v === 'string') dets.push(det({ kind: 'font', target: 'typography', confidence: 'high', source: 'json', label: `${titleCase(k)} — type`, data: { family: titleCase(k), stack: v, weight: '' } }));
      }
    }
    if (dets.length) return dets;
  }

  // 2) Colours in the text (hex / rgb / css vars)
  const colors = extractColors(trimmed);
  if (colors.length) {
    // Only treat as "colours" when the text is basically colour data, not prose that happens to contain a hex.
    const nonColorChars = trimmed.replace(HEX, '').replace(RGB, '').replace(/[\s,;:#(){}\-_]|rgba?|--[a-z0-9-]+|colou?r/gi, '').length;
    if (nonColorChars < 40 || /--|:\s*#|\bhex\b/i.test(trimmed)) {
      return colors.map((c) => colorDetection(c, c.name ? 'high' : 'med', 'text'));
    }
  }

  // 3) Prose — genuinely ambiguous. Do NOT guess; hand it to the "you pick" tray.
  const preview = trimmed.length > 80 ? trimmed.slice(0, 77) + '…' : trimmed;
  return [det({
    kind: 'text', target: null, confidence: 'low', source: 'text',
    label: preview, data: { text: trimmed }, choices: PROSE_CHOICES,
  })];
}

/* ---- detection builders ------------------------------------------------ */

function det(partial) {
  return {
    id: nextId(),
    targetLabel: partial.target ? TARGETS[partial.target].label : 'Needs your choice',
    ...partial,
  };
}
function colorDetection(c, confidence, source) {
  return det({
    kind: 'color', target: 'colors', confidence, source,
    label: `${c.name ? c.name + ' ' : ''}${c.hex}`,
    data: { hex: c.hex, name: c.name, role: c.role },
  });
}

/* ---- public API -------------------------------------------------------- */

/**
 * @param {Array<{type:'text',text:string}|{type:'file',name:string,mime?:string,size?:number}>} items
 * @returns {Array<object>} detections
 */
export function classify(items) {
  const detections = [];
  for (const item of items || []) {
    if (item.type === 'text') {
      detections.push(...classifyText(item.text || ''));
    } else if (item.type === 'file') {
      const c = classifyFile(item.name || '', item.mime || '');
      detections.push(det({
        kind: c.kind, target: c.target, confidence: c.confidence, source: 'file',
        label: item.name || '(file)', data: c.data,
      }));
    }
  }
  return detections;
}

/** Group detections by target for the confirm UI (nulls under "needs choice"). */
export function groupByTarget(detections) {
  const groups = new Map();
  for (const d of detections) {
    const key = d.target || '_needsChoice';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }
  return groups;
}
