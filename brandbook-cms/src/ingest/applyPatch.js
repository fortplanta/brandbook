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
    else if (t === 'motion') push('motion', { title: x.title || 'Motion', src: file });
    else if (t === 'downloads') { p._downloadItems = p._downloadItems || []; p._downloadItems.push({ label: x.label || x.file, file }); }
    else if (t === 'downloadAll') p.downloadAll = file;
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
  const arrays = ['colors', 'logos', 'typography', 'motion', 'platform', 'downloads'];
  for (const k of arrays) {
    if (patch[k]) out[k] = [...(current?.[k] || []), ...patch[k]];
  }
  if (patch.imagery) {
    out.imagery = { ...(current?.imagery || {}), images: [...(current?.imagery?.images || []), ...patch.imagery.images] };
  }
  for (const k of ['downloadAll', 'tagline', 'coverNote']) {
    if (patch[k] !== undefined) out[k] = patch[k];
  }
  if (patch.tone) out.tone = { ...(current?.tone || {}), ...patch.tone };
  return out;
}

async function uploadFile(base, file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${base}/api/media`, { method: 'POST', body: fd, credentials: 'include' });
  if (!res.ok) throw new Error(`Media upload failed (${res.status})`);
  const json = await res.json();
  return json.doc;
}

/**
 * Upload files, build + merge the patch, PATCH the client as a draft.
 * @param {{ base:string, docId:string|number, detections:any[], fileFor:Map<string,File> }} args
 * @returns {Promise<{ applied:number, patch:object }>}
 */
export async function applyIngest({ base, docId, detections, fileFor }) {
  // 1. upload every referenced file once
  const idByName = new Map();
  for (const d of detections) {
    const name = d.data && d.data.file;
    if (name && fileFor.has(name) && !idByName.has(name)) {
      const doc = await uploadFile(base, fileFor.get(name));
      idByName.set(name, doc.id);
    }
  }
  // 2. read current draft to append onto
  const cur = await fetch(`${base}/api/clients/${docId}?depth=0&draft=true`, { credentials: 'include' }).then((r) => r.json());

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
