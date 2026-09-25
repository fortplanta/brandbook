/**
 * logotypes-interaction.ts — client JS for the Logotyper chapter.
 *
 * Native scroll-snap (mandatory, on <html>) does the snapping — no scroll code
 * here. This module (1) tracks which section is centred and (2) drives the
 * pinned logo through a PLUGGABLE animation driver with a graceful fallback:
 *
 *     Rive  ─▶  Lottie  ─▶  SVG crossfade
 *
 * A client either has a rich logo animation or they don't. If their data points
 * to a .riv or .json it's loaded lazily (the runtime is fetched on demand, only
 * then), and if the file is missing, the runtime won't load, or anything throws,
 * it falls back to the SVG variant stack that's always in the DOM. The base
 * template has ZERO animation dependencies.
 */

const RIVE_CDN = 'https://cdn.jsdelivr.net/npm/@rive-app/canvas@2/+esm';
const LOTTIE_CDN = 'https://cdn.jsdelivr.net/npm/lottie-web@5/+esm';
const LOAD_TIMEOUT = 8000;

export interface LogoAnimation {
  type: 'rive' | 'lottie';
  src: string;
  runtimeUrl?: string;
  // rive
  artboard?: string;
  stateMachine?: string;
  numberInput?: string;      // a number input set to the section index (0..n-1), OR
  triggers?: string[];       // a trigger input to fire per section
  // lottie
  renderer?: 'svg' | 'canvas';
  segments?: [number, number][];  // [inFrame, outFrame] to play per section
}

interface LogoDriver { kind: string; go(index: number, variant: string): void; }

export function initLogotypes(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-lt-chapter]').forEach(setupChapter);
}

function setupChapter(chapter: HTMLElement): void {
  if (chapter.dataset.ltInit) return;              // idempotent — safe to call twice
  chapter.dataset.ltInit = '1';
  const frames = Array.from(chapter.querySelectorAll<HTMLElement>('[data-lt-frame]'));
  const ticks = Array.from(chapter.querySelectorAll<HTMLElement>('[data-tick]'));
  const media = chapter.querySelector<HTMLElement>('[data-lt-logo-media]');
  if (frames.length === 0 || !media) return;

  const ratios = new Map(frames.map((f) => [f, 0]));
  let index = -1;
  let pending = 0;
  let driver: LogoDriver | null = null;

  // Build the logo driver (async — runtime may need loading). Until it's ready,
  // and forever if it fails, the SVG fallback drives.
  const svg = svgDriver(media);
  driver = svg;
  buildRichDriver(media).then((rich) => {
    if (rich) {
      media.dataset.driver = rich.kind;          // CSS hides the SVG stack
      driver = rich;
      driver.go(pending, frames[pending].dataset.variant ?? '');
    } else {
      media.dataset.driver = 'svg';
    }
  });

  const setActiveFrame = (i: number): void => {
    if (i === index || i < 0) return;
    index = i; pending = i;
    const variant = frames[i].dataset.variant ?? '';
    frames.forEach((f, k) => f.classList.toggle('is-current', k === i));
    ticks.forEach((t, k) => t.classList.toggle('is-active', k === i));
    chapter.dataset.frame = String(i);
    driver?.go(i, variant);
  };

  const pickMostVisible = (): void => {
    let best = -1, bestRatio = 0;
    frames.forEach((f, i) => { const r = ratios.get(f) ?? 0; if (r > bestRatio) { bestRatio = r; best = i; } });
    if (best !== -1) setActiveFrame(best);
  };

  const io = new IntersectionObserver(
    (entries) => { for (const e of entries) ratios.set(e.target as HTMLElement, e.intersectionRatio); pickMostVisible(); },
    { threshold: [0, 0.25, 0.5, 0.75, 1] }
  );
  frames.forEach((f) => io.observe(f));
  requestAnimationFrame(() => { if (index === -1) setActiveFrame(0); });
}

/* ---- SVG crossfade: the always-available fallback (zero deps) ---- */
function svgDriver(media: HTMLElement): LogoDriver {
  const logos = Array.from(media.querySelectorAll<HTMLElement>('.lt-logo'));
  const byVariant = new Map(logos.map((l) => [l.dataset.variant ?? '', l]));
  return {
    kind: 'svg',
    go(_i, variant) { logos.forEach((l) => l.classList.toggle('is-active', l === byVariant.get(variant))); },
  };
}

/* ---- rich driver: read the client's config, try to build it, else null ---- */
async function buildRichDriver(media: HTMLElement): Promise<LogoDriver | null> {
  const cfgEl = media.querySelector('[data-lt-anim]');
  if (!cfgEl?.textContent) return null;               // no animation for this client
  let cfg: LogoAnimation;
  try { cfg = JSON.parse(cfgEl.textContent); } catch { return null; }
  try {
    if (cfg.type === 'rive') return await riveDriver(media, cfg);
    if (cfg.type === 'lottie') return await lottieDriver(media, cfg);
  } catch (err) {
    console.warn('[logotypes] rich logo animation failed, using SVG fallback:', err);
  }
  return null;
}

// Load a runtime from a global first (if the client bundled it), else lazily
// from a CDN URL. `@vite-ignore` keeps the bundler from touching it, so the base
// template never pulls these in.
async function loadRuntime(globalKey: string, url: string): Promise<any> {
  const existing = (window as any)[globalKey];
  if (existing) return existing;
  const mod = await import(/* @vite-ignore */ url);
  return mod.default ?? mod;
}

async function riveDriver(media: HTMLElement, cfg: LogoAnimation): Promise<LogoDriver> {
  const R = await loadRuntime('rive', cfg.runtimeUrl ?? RIVE_CDN);
  const canvas = media.querySelector<HTMLCanvasElement>('[data-lt-rive]');
  if (!canvas) throw new Error('no rive canvas');
  const r = new R.Rive({
    canvas, src: cfg.src, artboard: cfg.artboard,
    stateMachines: cfg.stateMachine, autoplay: true,
  });
  await new Promise<void>((res, rej) => {
    r.on(R.EventType.Load, () => res());
    setTimeout(() => rej(new Error('rive load timeout')), LOAD_TIMEOUT);
  });
  const inputs = cfg.stateMachine ? r.stateMachineInputs(cfg.stateMachine) : [];
  const byName = (n: string) => inputs.find((i: any) => i.name === n);
  return {
    kind: 'rive',
    go(i) {
      if (cfg.numberInput) { const inp = byName(cfg.numberInput); if (inp) inp.value = i; }
      else if (cfg.triggers?.[i]) { const t = byName(cfg.triggers[i]); if (t) t.fire(); }
    },
  };
}

async function lottieDriver(media: HTMLElement, cfg: LogoAnimation): Promise<LogoDriver> {
  const L = await loadRuntime('lottie', cfg.runtimeUrl ?? LOTTIE_CDN);
  const container = media.querySelector<HTMLElement>('[data-lt-lottie]');
  if (!container) throw new Error('no lottie container');
  const anim = L.loadAnimation({
    container, path: cfg.src, renderer: cfg.renderer ?? 'svg', autoplay: false, loop: false,
  });
  await new Promise<void>((res, rej) => {
    anim.addEventListener('DOMLoaded', () => res());
    anim.addEventListener('data_failed', () => rej(new Error('lottie data_failed')));
    setTimeout(() => rej(new Error('lottie load timeout')), LOAD_TIMEOUT);
  });
  return {
    kind: 'lottie',
    go(i) { const seg = cfg.segments?.[i]; if (seg) anim.playSegments(seg, true); },
  };
}

if (typeof document !== 'undefined') {
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', () => initLogotypes())
    : initLogotypes();
}
