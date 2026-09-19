/* Drop-zone prototype UI. Uses the ingest engine (classify / groupByTarget /
   TARGETS). Pure DOM, no framework. */
import { classify, groupByTarget, TARGETS } from './classify.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

const zone = $('#zone');
const fileInput = $('#file');
const panel = $('#panel');
const results = $('#results');
const applyBtn = $('#apply');
const clearBtn = $('#clear');
const out = $('#out');
const outWrap = $('#outwrap');
const countEl = $('#count');

let detections = [];         // current detections (each gets a live `target` + edits)
const fileFor = new Map();   // filename -> File (for thumbnails + real upload later)

/* ---- ingest ---- */

function itemsFromDataTransfer(dt) {
  const items = [];
  for (const f of dt.files || []) { items.push({ type: 'file', name: f.name, mime: f.type, size: f.size }); fileFor.set(f.name, f); }
  const text = dt.getData ? dt.getData('text/plain') : '';
  if (text && text.trim() && (!dt.files || dt.files.length === 0)) items.push({ type: 'text', text });
  return items;
}

function ingest(items) {
  if (!items.length) return;
  const fresh = classify(items);
  detections = detections.concat(fresh);
  render();
}

/* ---- rendering ---- */

const SWATCH_KINDS = new Set(['color']);
function thumb(d) {
  if (d.kind === 'color') { const s = el('span', 'sw'); s.style.background = d.data.hex; return s; }
  const f = d.data.file && fileFor.get(d.data.file);
  if (f && /^image\/|svg/.test(f.type)) { const img = el('img', 'thumb'); img.src = URL.createObjectURL(f); return img; }
  const glyphs = { font: 'Aa', motion: '►', download: '⤓', downloadAll: '⤓', logo: '◆', image: '▣', text: '¶' };
  const g = el('span', 'glyph', glyphs[d.kind] || '•'); return g;
}

const TARGET_KEYS = Object.keys(TARGETS);
function targetSelect(d) {
  const sel = el('select', 'route');
  if (!d.target) { const o = el('option', null, '— choose a field —'); o.value = ''; sel.appendChild(o); }
  for (const k of TARGET_KEYS) { const o = el('option', null, TARGETS[k].label); o.value = k; if (k === d.target) o.selected = true; sel.appendChild(o); }
  sel.addEventListener('change', () => { d.target = sel.value || null; render(); });
  return sel;
}

function editable(d) {
  const wrap = el('span', 'edits');
  if (d.kind === 'color') {
    const name = el('input', 'edit'); name.value = d.data.name || ''; name.placeholder = 'name';
    name.addEventListener('input', () => (d.data.name = name.value));
    const role = el('input', 'edit edit--sm'); role.value = d.data.role || ''; role.placeholder = 'role';
    role.addEventListener('input', () => (d.data.role = role.value));
    wrap.append(name, role);
  } else if (d.kind === 'font') {
    const fam = el('input', 'edit'); fam.value = d.data.family || ''; fam.placeholder = 'family';
    fam.addEventListener('input', () => (d.data.family = fam.value));
    wrap.append(fam);
    if (d.data.weight) wrap.append(el('span', 'tag', d.data.weight));
  }
  return wrap;
}

function row(d) {
  const r = el('div', 'row' + (d.target ? '' : ' row--needs'));
  r.append(thumb(d));
  const mid = el('div', 'mid');
  mid.append(el('div', 'label', d.label));
  const meta = el('div', 'meta');
  meta.append(editable(d));
  mid.append(meta);
  r.append(mid);
  const right = el('div', 'right');
  right.append(targetSelect(d));
  const dot = el('span', 'conf conf--' + d.confidence); dot.title = d.confidence + ' confidence'; right.append(dot);
  const rm = el('button', 'rm', '×'); rm.title = 'Remove'; rm.addEventListener('click', () => { detections = detections.filter((x) => x !== d); render(); });
  right.append(rm);
  r.append(right);
  return r;
}

function render() {
  results.innerHTML = '';
  panel.hidden = detections.length === 0;
  zone.classList.toggle('zone--slim', detections.length > 0);
  countEl.textContent = detections.length ? `${detections.length} detected` : '';

  const groups = groupByTarget(detections);
  // needs-choice first, then the rest in TARGETS order
  const order = ['_needsChoice', ...TARGET_KEYS];
  for (const key of order) {
    const list = groups.get(key);
    if (!list || !list.length) continue;
    const card = el('div', 'card' + (key === '_needsChoice' ? ' card--needs' : ''));
    const head = el('div', 'card__head');
    head.append(el('span', 'card__title', key === '_needsChoice' ? 'Needs your choice' : TARGETS[key].label));
    head.append(el('span', 'card__n', String(list.length)));
    card.append(head);
    for (const d of list) card.append(row(d));
    results.append(card);
  }

  const unresolved = detections.some((d) => !d.target);
  applyBtn.disabled = unresolved || detections.length === 0;
  applyBtn.textContent = unresolved ? 'Resolve the highlighted items first' : `Apply → ${detections.length} field${detections.length === 1 ? '' : 's'}`;
  outWrap.hidden = true;
}

/* ---- apply → assemble the Profile-shaped patch ---- */

function buildPatch() {
  const p = {};
  const push = (k, v) => { (p[k] = p[k] || []).push(v); };
  for (const d of detections) {
    const t = d.target, x = d.data;
    if (t === 'colors') push('colors', { name: x.name || undefined, hex: x.hex, role: x.role || undefined });
    else if (t === 'logos') push('logos', { name: x.name || 'Logo', image: x.file || undefined });
    else if (t === 'typography') push('typography', { name: x.family, stack: x.stack, weights: x.weight || undefined, files: x.file ? [{ label: x.weight || 'Regular', file: x.file }] : undefined });
    else if (t === 'imagery') { p.imagery = p.imagery || { images: [] }; p.imagery.images.push({ src: x.file, caption: x.caption || undefined }); }
    else if (t === 'motion') push('motion', { title: x.title || 'Motion', src: x.file });
    else if (t === 'downloads') { p.downloads = p.downloads || [{ group: 'Files', items: [] }]; p.downloads[0].items.push({ label: x.label || x.file, file: x.file }); }
    else if (t === 'downloadAll') p.downloadAll = x.file;
    else if (t === 'tagline') p.tagline = x.text;
    else if (t === 'coverNote') p.coverNote = x.text;
    else if (t === 'tone.boilerplate') { p.tone = p.tone || {}; p.tone.boilerplate = x.text; }
    else if (t === 'platform') push('platform', { title: 'Untitled', body: x.text });
  }
  return p;
}

applyBtn.addEventListener('click', () => {
  if (applyBtn.disabled) return;
  out.textContent = JSON.stringify(buildPatch(), null, 2);
  outWrap.hidden = false;
  outWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

clearBtn.addEventListener('click', () => { detections = []; fileFor.clear(); render(); });

/* ---- input wiring: drag, paste, click-to-browse, sample ---- */

['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('zone--over'); }));
['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); if (ev !== 'dragleave' || e.target === zone) zone.classList.remove('zone--over'); }));
zone.addEventListener('drop', (e) => ingest(itemsFromDataTransfer(e.dataTransfer)));
zone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const items = [];
  for (const f of fileInput.files) { items.push({ type: 'file', name: f.name, mime: f.type, size: f.size }); fileFor.set(f.name, f); }
  ingest(items); fileInput.value = '';
});
window.addEventListener('paste', (e) => {
  const dt = e.clipboardData; if (!dt) return;
  const items = [];
  for (const f of dt.files || []) { items.push({ type: 'file', name: f.name, mime: f.type, size: f.size }); fileFor.set(f.name, f); }
  const text = dt.getData('text/plain');
  if (text && text.trim() && (!dt.files || dt.files.length === 0)) items.push({ type: 'text', text });
  if (items.length) { e.preventDefault(); ingest(items); }
});

$('#sample').addEventListener('click', (e) => {
  e.stopPropagation();
  ingest([
    { type: 'text', text: 'Sky #6BB4F8\nAzure #238FF4\nSignal #0B78DE\nInk #010A13\nSand #FADF93' },
    { type: 'file', name: 'tangent-wordmark.svg', mime: 'image/svg+xml' },
    { type: 'file', name: 'tangent-symbol.svg', mime: 'image/svg+xml' },
    { type: 'file', name: 'GeneralSans-Semibold.otf', mime: 'font/otf' },
    { type: 'file', name: 'mock-signage.png', mime: 'image/png' },
    { type: 'file', name: 'logo-reveal.mp4', mime: 'video/mp4' },
    { type: 'file', name: 'tangent-brand-assets.zip', mime: 'application/zip' },
    { type: 'text', text: 'We partner with companies to optimize operational execution using our purpose-built agentic platform.' },
  ]);
});

render();
