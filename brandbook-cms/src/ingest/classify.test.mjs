import assert from 'node:assert/strict';
import { classify, extractColors, fontFromFilename } from './classify.js';

let pass = 0;
const t = (name, fn) => { try { fn(); pass++; console.log(`  ok  ${name}`); } catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; } };
const one = (items) => classify(items);
const targets = (d) => d.map((x) => x.target);

console.log('ingest engine tests\n');

t('single hex → one colour, normalised + upper', () => {
  const d = one([{ type: 'text', text: '#0b78de' }]);
  assert.equal(d.length, 1);
  assert.equal(d[0].target, 'colors');
  assert.equal(d[0].data.hex, '#0B78DE');
});

t('"Name #hex" keeps the name', () => {
  const d = one([{ type: 'text', text: 'Signal #0B78DE' }]);
  assert.equal(d[0].data.name, 'Signal');
  assert.equal(d[0].confidence, 'high');
});

t('multi-line palette → many colours with names', () => {
  const d = one([{ type: 'text', text: 'Sky #6BB4F8\nAzure #238FF4\nSignal #0B78DE' }]);
  assert.equal(d.length, 3);
  assert.deepEqual(d.map((x) => x.data.name), ['Sky', 'Azure', 'Signal']);
  assert.ok(d.every((x) => x.target === 'colors'));
});

t('CSS custom properties → named colours', () => {
  const d = one([{ type: 'text', text: ':root{--color-signal:#0B78DE;--color-ink:#010A13;}' }]);
  assert.deepEqual(targets(d), ['colors', 'colors']);
  assert.deepEqual(d.map((x) => x.data.name), ['Signal', 'Ink']);
});

t('JSON token object → colours + font', () => {
  const d = one([{ type: 'text', text: '{"color":{"signal":"#0B78DE"},"font":{"display":"General Sans, sans-serif"}}' }]);
  assert.ok(d.some((x) => x.target === 'colors' && x.data.hex === '#0B78DE'));
  assert.ok(d.some((x) => x.target === 'typography' && /General Sans/.test(x.data.stack)));
});

t('SVG named wordmark → logo (high)', () => {
  const d = one([{ type: 'file', name: 'tangent-wordmark.svg' }]);
  assert.equal(d[0].target, 'logos');
  assert.equal(d[0].confidence, 'high');
});

t('raster with photo-ish name → imagery', () => {
  const d = one([{ type: 'file', name: 'mock-signage.png' }]);
  assert.equal(d[0].target, 'imagery');
});

t('raster named logo → logos', () => {
  const d = one([{ type: 'file', name: 'logo-dark.png' }]);
  assert.equal(d[0].target, 'logos');
});

t('font file → typography with parsed family + weight', () => {
  const d = one([{ type: 'file', name: 'GeneralSans-Semibold.otf' }]);
  assert.equal(d[0].target, 'typography');
  assert.equal(d[0].data.family, 'General Sans');
  assert.equal(d[0].data.weight, 'Semibold');
});

t('serif font name → serif stack', () => {
  const f = fontFromFilename('GT-Sectra-Medium.otf');
  assert.match(f.stack, /serif/);
  assert.equal(f.weight, 'Medium');
});

t('mp4 → motion', () => {
  assert.equal(one([{ type: 'file', name: 'logo-reveal.mp4' }])[0].target, 'motion');
});

t('brand-assets zip → downloadAll', () => {
  assert.equal(one([{ type: 'file', name: 'tangent-brand-assets.zip' }])[0].target, 'downloadAll');
});

t('generic zip → downloads', () => {
  assert.equal(one([{ type: 'file', name: 'presskit.zip' }])[0].target, 'downloads');
});

t('prose → needs choice (never guessed)', () => {
  const d = one([{ type: 'text', text: 'We partner with companies to optimize operational execution using our purpose-built agentic platform.' }]);
  assert.equal(d[0].target, null);
  assert.ok(Array.isArray(d[0].choices) && d[0].choices.length >= 3);
});

t('prose that happens to contain a hex is still prose', () => {
  const d = one([{ type: 'text', text: 'Our signal blue is #0B78DE and it carries the whole system across every surface we ship.' }]);
  assert.equal(d[0].target, null);
});

t('mixed batch routes each item independently', () => {
  const d = one([
    { type: 'file', name: 'symbol.svg' },
    { type: 'file', name: 'General Sans.woff2' },
    { type: 'text', text: '#FADF93' },
    { type: 'file', name: 'reel.mp4' },
  ]);
  assert.deepEqual(targets(d), ['logos', 'typography', 'colors', 'motion']);
});

t('extractColors dedupes repeats', () => {
  const c = extractColors('#0B78DE #0b78de #0B78DE');
  assert.equal(c.length, 1);
});

console.log(`\n${pass} passed`);
