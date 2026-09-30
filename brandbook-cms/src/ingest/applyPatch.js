/* ============================================================================
   APPLY — turns resolved detections into real writes: upload each File to the
   Media collection, then PATCH the client document as a DRAFT (append to arrays,
   set scalars). Draft, never publish — the editor reviews the populated fields
   and hits Publish themselves. Same confirm-then-commit spirit as the engine.

   Browser-oriented (uses fetch + FormData + cookies). The Payload Local API
   performs the identical operations server-side — see applyPatch.localtest.mjs,
   which verifies the shape end to end.
   ========================================================================== */

/** Build the Profile-shaped patch from resolved detections.
 *  `mediaId(name)` returns the uploaded media id for a file name (or undefined). */
export function buildPatch(detections, mediaId = () => undefined) {
  const p = {};
  const push = (k, v) => { (p[k] = p[k] || []).push(v); };
  for (const d of detections) {
    const t = d.target, x = d.data || {};
    const file = x.file ? mediaId(x.file) : undefined;
    if (t === 'colors') push('colors', { name: x.name || undefined, hex: x.hex, role: x.role || undefined });
    else if (t === 'logos') push('logos', { name: x.name || 'Logo', onDark: false, image: file });
    else if (t === 'typography') push('typography', { name: x.family, stack: x.stack, weights: x.weight || undefined, files: file ? [{ label: x.weight || 'Regular', file }] : undefined });
    else if (t === 'imagery') { p.imagery = p.imagery || { images: [] }; p.imagery.images.push({ image: file, caption: x.caption || undefined }); }
    else if (t === 'colorInUse') push('colorInUse', { image: file, caption: x.caption || undefined, colors: x.paletteNames || undefined });
    else if (t === 'applications') push('applications', { image: file, kind: x.kind || 'example', caption: x.caption || undefined });
    else if (t === 'graphics') push('graphics', { image: file, caption: x.caption || undefined });
    else if (t === 'motion') push('motion', { title: x.title || 'Motion', src: file });
    else if (t === 'downloads') { p._downloadItems = p._downloadItems || []; p._downloadItems.push({ label: x.label || x.file, file }); }
    else if (t === 'downloadAll') p.downloadAll = file;
    else if (t === 'keyVisual') p.keyVisual = file;
    else if (t === 'tagline') p.tagline = x.text;
    else if (t === 'coverNote') p.coverNote = x.text;
    else if (t === 'tone.boilerplate') { p.tone = p.tone || {}; p.tone.boilerplate = x.text; }
    else if (t === 'platform') push('platform', { title: 'Untitled', body: x.text });
  }
  if (p._downloadItems) { p.downloads = [{ group: 'Ingested', items: p._downloadItems }]; delete p._downloadItems; }
  return p;
}

/** Merge a patch onto the current document: append arrays, set scalars/groups. */
export function mergeAppend(current, patch) {
  const out = {};
  const arrays = ['colors', 'logos', 'typography', 'motion', 'platform', 'downloads', 'colorInUse', 'applications', 'graphics'];
  for (const k of arrays) {
    if (patch[k]) out[k] = [...(current?.[k] || []), ...patch[k]];
  }
  if (patch.imagery) {
    out.imagery = { ...(current?.imagery || {}), images: [...(current?.imagery?.images || []), ...patch.imagery.images] };
  }
  for (const k of ['downloadAll', 'keyVisual', 'tagline', 'coverNote']) {
    if (patch[k] !== undefined) out[k] = patch[k];
  }
  if (patch.tone) out.tone = { ...(current?.tone || {}), ...patch.tone };
  return out;
}

async function uploadFile(base, file, meta) {
  const fd = new FormData();
  fd.append('file', file);
  if (meta) fd.append('_payload', JSON.stringify(meta));   // alt, category, paletteColors, autoTagged
  const res = await fetch(`${base}/api/media`, { method: 'POST', body: fd, credentials: 'include' });
  if (!res.ok) throw new Error(`Media upload failed (${res.status})`);
  const json = await res.json();
  return json.doc;
}

/* Analysed images get a real name instead of "img2.png":
   {client-slug}-{category}-{nn}.{ext}, numbered per category — continuing from
   what the client already has, so a second batch doesn't collide with the first. */
const extOf = (name = '') => (name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
function existingCounts(cur) {
  const apps = cur?.applications || [];
  const byKind = (k) => apps.filter((a) => a?.kind === k).length;
  return {
    logo: (cur?.logos || []).length, color: (cur?.colorInUse || []).length, graphics: (cur?.graphics || []).length,
    photo: (cur?.imagery?.images || []).length, motion: (cur?.motion || []).length, keyvisual: cur?.keyVisual ? 1 : 0,
    digital: byKind('digital'), print: byKind('print'), environment: byKind('environment'), merch: byKind('merch'),
  };
}
function renamer(slug, cur) {
  const n = existingCounts(cur);
  return (d) => {
    const cat = d.data?.category;
    if (!cat) return null;
    n[cat] = (n[cat] || 0) + 1;
    return `${slug || 'brand'}-${cat}-${String(n[cat]).padStart(2, '0')}${extOf(d.data.file)}`;
  };
}

/**
 * Upload files, build + merge the patch, PATCH the client as a draft.
 * @param {{ base:string, docId:string|number, detections:any[], fileFor:Map<string,File> }} args
 * @returns {Promise<{ applied:number, patch:object }>}
 */
export async function applyIngest({ base, docId, detections, fileFor }) {
  // 1. read the current draft (to append onto, and for the slug used in names)
  const cur = await fetch(`${base}/api/clients/${docId}?depth=0&draft=true`, { credentials: 'include' }).then((r) => r.json());

  // 2. upload every referenced file once — analysed images renamed + tagged
  const idByName = new Map();
  const nameFor = renamer(cur?.slug, cur);
  for (const d of detections) {
    const name = d.data && d.data.file;
    if (name && fileFor.has(name) && !idByName.has(name)) {
      let file = fileFor.get(name);
      let meta;
      const renamed = nameFor(d);
      if (renamed) {
        file = new File([file], renamed, { type: file.type });
        meta = {
          alt: [d.data.caption, d.data.paletteNames].filter(Boolean).join(' — ') || undefined,   // e.g. "Färg i bruk — Sand, Navy"
          category: d.data.category,
          paletteColors: d.data.paletteNames || undefined,
          autoTagged: !d.data.byHand,
          transparent: (d.ai?.signals?.transparentShare ?? 0) > 0.15,
        };
      }
      const doc = await uploadFile(base, file, meta);
      idByName.set(name, doc.id);
    }
  }

  // 3. build + merge
  const patch = buildPatch(detections, (n) => idByName.get(n));
  const merged = mergeAppend(cur, patch);

  // 4. PATCH as draft — nothing goes live until the editor hits Publish
  const res = await fetch(`${base}/api/clients/${docId}?draft=true`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(merged),
  });
  if (!res.ok) throw new Error(`Save failed (${res.status}): ${await res.text()}`);
  return { applied: detections.length, patch: merged };
}
