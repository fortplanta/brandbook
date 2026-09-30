/**
 * Progressive enhancement — the only client JS. The book is fully readable
 * without it; this adds active-nav tracking, copy-to-clipboard, print, and the
 * mobile menu. No dependencies.
 */
document.documentElement.classList.add('js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion = !reduceMotion;
// A single class gates all motion. CSS-only scroll timelines proved unreliable
// inside embedded/preview frames, so every effect below is JS-driven instead.
if (motion) document.documentElement.classList.add('anim');

/* 1. Scroll reveals — JS (IntersectionObserver). Fires in any frame, unlike
      CSS scroll timelines. Content is visible by default; we only hide-then-
      reveal when motion is on. */
if (motion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.04 }
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
}

/* 2. Active-section highlight + drawer minimize — ONE stable, rAF-throttled
      scroll handler. The active section is the last one whose top has crossed a
      fixed line ~32% down the viewport. That test is monotonic as you scroll, so
      the indicator dot moves once per boundary instead of flickering between
      overlapping intersection ratios (the old jitter). */
const links = new Map<string, HTMLElement>();
document.querySelectorAll<HTMLElement>('[data-nav-link]').forEach((l) =>
  links.set(l.dataset.navLink!, l)
);
const sections = Array.from(document.querySelectorAll<HTMLElement>('section[id]'));
const drawer = document.querySelector<HTMLElement>('[data-nav]');
const progress = document.querySelector<HTMLElement>('.progress');

/* Accordion categories: measure each sub-list into --cat-h so it collapses from
   a real height; map each section to its category; wire the open/close toggles. */
const cats = Array.from(document.querySelectorAll<HTMLElement>('.cat'));
const sectionCat = new Map<string, HTMLElement>();

/* "+ N till": shows a category's secondary pages in place. Opens by itself when
   you scroll into one of them (the current page is never hidden), and resets
   whenever its category closes. */
const setMore = (cat: HTMLElement, on: boolean) => {
  const btn = cat.querySelector<HTMLElement>('[data-cat-more]');
  if (!btn) return;
  cat.toggleAttribute('data-more', on);
  btn.setAttribute('aria-expanded', String(on));
  const label = btn.querySelector<HTMLElement>('[data-cat-more-label]');
  if (label) label.textContent = on ? 'Visa färre' : (btn.dataset.moreLabel ?? '');
};

const setCatOpen = (cat: HTMLElement, open: boolean) => {
  if (cat.classList.contains('cat--locked')) return;
  cat.setAttribute('data-open', String(open));
  cat.querySelector('[data-cat-toggle]')?.setAttribute('aria-expanded', String(open));
  if (!open) setMore(cat, false);
};

/* Suppress the collapse transition while we set the JS baseline, so nothing
   animates shut on load (removed after first paint). */
drawer?.classList.add('nav--boot');

cats.forEach((cat) => {
  const list = cat.querySelector<HTMLElement>('.cat__list');
  const inner = list?.firstElementChild as HTMLElement | null;
  if (list && inner) {
    const measure = () => cat.style.setProperty('--cat-h', `${inner.offsetHeight}px`);
    measure();
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(inner);
    else window.addEventListener('resize', measure, { passive: true });
  }
  cat.querySelectorAll<HTMLElement>('[data-nav-link]').forEach((l) => {
    const id = l.getAttribute('data-nav-link');
    if (id) sectionCat.set(id, cat);
  });
  // JS baseline: collapsed. (No-JS keeps them open so the book stays readable.)
  setCatOpen(cat, false);

  const head = cat.querySelector<HTMLButtonElement>('[data-cat-toggle]');
  head?.addEventListener('click', () => {
    setCatOpen(cat, cat.getAttribute('data-open') !== 'true');
  });
  cat.querySelector('[data-cat-more]')?.addEventListener('click', () => setMore(cat, !cat.hasAttribute('data-more')));
});

/* Chapter heroes (one per category) count as their category in the nav: while
   a hero is in view its category opens, like for its sections. Their looping
   effects run only while on screen. */
const chapters = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]'));
chapters.forEach((ch) => {
  const cat = cats.find((c) => c.dataset.cat === ch.dataset.chapter);
  if (cat) sectionCat.set(ch.id, cat);
});
if (motion && 'IntersectionObserver' in window) {
  const live = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle('is-live', e.isIntersecting);
  });
  chapters.forEach((ch) => live.observe(ch));
  const coverEl = document.querySelector('[data-cover]');   // the cover's glow drifts only while on screen
  if (coverEl) live.observe(coverEl);
}

// Re-enable transitions once the collapsed baseline has painted.
requestAnimationFrame(() => requestAnimationFrame(() => drawer?.classList.remove('nav--boot')));

const MINIMIZE_AT = 0.25; // fraction of one viewport scrolled before the rail collapses
const LINE = 0.32;        // active-section trigger line, as a fraction down the viewport
let currentId = '';
let ticking = false;

/* Logo chapter MotionController. A generic scroll→progress pipeline: the
   primary logo pins and scrubs from hero (--t 0) to compact (--t 1) over the
   first TRANSITION_VH of the chapter, then holds. The transform target (--tx,
   --ty = the delta from the centred hero to the compact anchor) is MEASURED
   from layout, so it holds for any logo size or palette — no per-client logic.
   Planes settle in via their own observer. Everything reads from params. */
const chapter = document.querySelector<HTMLElement>('[data-logochapter]');
const logoStage = chapter?.querySelector<HTMLElement>('[data-logostage]') ?? null;
const logoMark = chapter?.querySelector<HTMLElement>('[data-logomark]') ?? null;
const ANCHOR_X_REM = 2;      // compact logo inset from the left, in rem
const ANCHOR_Y_REM = 1.9;    // compact logo inset from the top, in rem
const TRANSITION_VH = 0.78;  // scroll distance (in viewports) for hero→compact

function measureLogoTargets() {
  if (!motion || !chapter || !logoStage || !logoMark) return;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const min = parseFloat(getComputedStyle(chapter).getPropertyValue('--logo-min')) || 0.42;
  const center = chapter.classList.contains('logochapter--center');
  // offsets are layout-based, so unaffected by the current transform
  const heroCX = logoMark.offsetLeft + logoMark.offsetWidth / 2;
  const heroCY = logoMark.offsetTop + logoMark.offsetHeight / 2;
  const targetCX = center ? logoStage.clientWidth / 2 : ANCHOR_X_REM * rem + (logoMark.offsetWidth * min) / 2;
  const targetCY = ANCHOR_Y_REM * rem + (logoMark.offsetHeight * min) / 2;
  // set on the stage so the mark AND the eyebrow/tagline siblings all inherit
  logoStage.style.setProperty('--tx', `${Math.round(targetCX - heroCX)}px`);
  logoStage.style.setProperty('--ty', `${Math.round(targetCY - heroCY)}px`);
}

function driveLogoChapter() {
  if (!motion || !chapter || !logoStage || !logoMark) return;
  const scrolled = Math.max(0, -chapter.getBoundingClientRect().top);
  const t = Math.min(1, scrolled / (window.innerHeight * TRANSITION_VH));
  logoStage.style.setProperty('--t', String(t));
  logoStage.dataset.phase = t < 0.02 ? 'hero' : t > 0.985 ? 'compact' : 'sticky';
}

/* Plane entrance — settle each plane once as it crosses in. */
if (motion && chapter && 'IntersectionObserver' in window) {
  const pio = new IntersectionObserver(
    (entries) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); pio.unobserve(e.target); } },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
  );
  chapter.querySelectorAll('[data-plane]').forEach((pl) => pio.observe(pl));
}
measureLogoTargets();
// the logo SVG may size after first paint — re-measure once it's ready
window.addEventListener('load', () => { measureLogoTargets(); measureSections(); onScroll(); });
if (logoMark) { const img = logoMark.querySelector('img'); if (img && !img.complete) img.addEventListener('load', () => { measureLogoTargets(); onScroll(); }); }

/* Section tops in document coordinates, cached so the scroll handler never
   forces a layout (reading getBoundingClientRect per frame would re-run layout
   while the drawer is mid-transition). Re-measured whenever the page resizes. */
let sectionTops: number[] = [];
/* Chapter heroes (mask) + cover (parallax): cached geometry, re-measured with
   the sections; the scroll handler writes transforms straight to the few
   elements that move, and only when a value changes. */
interface ChapterState {
  el: HTMLElement; stage: HTMLElement | null; fx: HTMLElement | null;
  curtains: HTMLElement[]; top: number; h: number;
  out: { open: string; lag: string; fx: string };
  stick: HTMLElement | null; stickOn: boolean;   // the category's sticky pill
}
const chapterState: ChapterState[] = chapters.map((el) => ({
  el,
  stage: el.querySelector<HTMLElement>('.chapter__stage'),
  fx: el.querySelector<HTMLElement>('.chapter__fx'),
  curtains: Array.from(el.querySelectorAll<HTMLElement>('.chapter__curtain')),
  top: 0, h: 0,
  out: { open: '', lag: '', fx: '' },
  stick: el.closest('[data-catwrap]')?.querySelector<HTMLElement>('.catstick') ?? null, stickOn: false,
}));
const cover = document.querySelector<HTMLElement>('[data-cover]');
const coverMedia = cover?.querySelector<HTMLElement>('[data-cover-media]') ?? null;
let coverH = 0, coverOut = '';
const measureSections = () => {
  sectionTops = sections.map((s) => s.getBoundingClientRect().top + window.scrollY);
  for (const c of chapterState) {
    c.top = c.el.getBoundingClientRect().top + window.scrollY;
    c.h = c.el.offsetHeight;
  }
  coverH = cover?.offsetHeight ?? 0;
  // mobile: the nav is a top bar; the sticky category pill sits just under it
  if (drawer && window.matchMedia('(max-width: 900px)').matches) {
    document.documentElement.style.setProperty('--topbar-h', `${drawer.offsetHeight}px`);
  }
};
measureSections();
if ('ResizeObserver' in window) new ResizeObserver(() => { measureSections(); }).observe(document.body);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (t: number) => t * t * (3 - 2 * t);

/* Chapter mask (values measured from the reference):
   rel = the block's top relative to the viewport.
   • open  — smoothstep from rel = 0.7·vh (window closed, ~39% wide) to rel = 0
             (full-bleed); the curtains slide out by that fraction
   • lag   — the stage sits 25% of its height low, easing in as (rel/vh)²
   • fx    — parallax at 0.15× rel (the layer is oversized by 16% to cover it)
   • text  — staggers in once, when the window is ~85% open */
function paintChapter(c: ChapterState, y: number, vh: number) {
  const rel = c.top - y;
  const open = smooth(clamp01((0.7 * vh - rel) / (0.7 * vh)));
  const out = {
    open: open.toFixed(4),
    lag: `translateY(${(0.25 * c.h * clamp01(rel / vh) ** 2).toFixed(1)}px)`,
    fx: `translateY(${(Math.max(-vh, Math.min(vh, rel)) * -0.15).toFixed(1)}px)`,
  };
  if (out.open !== c.out.open) {
    const pct = (open * 100).toFixed(2);
    if (c.curtains[0]) c.curtains[0].style.transform = `translateX(-${pct}%)`;
    if (c.curtains[1]) c.curtains[1].style.transform = `translateX(${pct}%)`;
  }
  if (out.lag !== c.out.lag && c.stage) c.stage.style.transform = out.lag;
  if (out.fx !== c.out.fx && c.fx) c.fx.style.transform = out.fx;
  c.out = out;
  if (open > 0.85) c.el.classList.add('is-in');                       // entrance fires once
}

function onScroll() {
  ticking = false;
  if (drawer) drawer.toggleAttribute('data-min', window.scrollY > window.innerHeight * MINIMIZE_AT);
  driveLogoChapter();

  // Category indicator: each chapter's sticky pill (.catstick, plain CSS sticky)
  // shows once its hero has scrolled past the top, and hides again above it.
  // Decided from cached positions (not an IntersectionObserver) so it's right
  // even after a jump — e.g. a sidebar click straight to a page.
  for (const c of chapterState) {
    const on = window.scrollY > c.top + c.h - 40;
    if (c.stick && c.stickOn !== on) { c.stickOn = on; c.stick.classList.toggle('is-on', on); }
  }

  if (motion) {
    const y = window.scrollY, vh = window.innerHeight;
    // Cover: the media layer drifts down at 0.3× scroll, so it reads as moving
    // at ~0.7× speed behind the sticky title.
    if (coverMedia && y <= coverH + 50) {
      const v = `translateY(${(Math.min(y, coverH) * 0.3).toFixed(1)}px)`;
      if (v !== coverOut) { coverOut = v; coverMedia.style.transform = v; }
    }
    // Chapter masks: only blocks near the viewport are painted.
    for (const c of chapterState) {
      if (c.top - y > vh * 1.5 || c.top + c.h - y < -vh * 0.5) continue;
      paintChapter(c, y, vh);
    }
  }

  // Scroll progress bar (JS-driven — no CSS scroll timeline needed).
  if (progress && motion) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.setProperty('--sp', String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
  }

  if (links.size && sections.length) {
    const line = window.scrollY + window.innerHeight * LINE;
    let activeId = sections[0].id;
    for (let i = 0; i < sections.length; i++) {
      if (sectionTops[i] <= line) activeId = sections[i].id;
      else break;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      activeId = sections[sections.length - 1].id;
    }
    if (activeId !== currentId) {
      currentId = activeId;
      links.forEach((l, key) => l.setAttribute('aria-current', String(key === activeId)));
      // Single-open accordion driven by scroll: the category owning the active
      // section opens; every other one collapses. At the top (cover — no owning
      // category) they're all closed, which is the collapsed-on-landing state.
      const activeCat = sectionCat.get(activeId);
      cats.forEach((c) => {
        c.toggleAttribute('data-active', c === activeCat);
        setCatOpen(c, c === activeCat);
      });
      // scrolled into a secondary page → reveal the rest so it's highlighted
      if (activeCat && links.get(activeId)?.closest('.nav__item--more')) setMore(activeCat, true);
    }
  }
}
onScroll();
window.addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
window.addEventListener('resize', () => { measureLogoTargets(); measureSections(); onScroll(); }, { passive: true });

/* 3. Copy-to-clipboard — swatches/tints ([data-copy] = the value) and the
      resource buttons ([data-copy-text]). A copied element gets .is-copied
      (its icon flips to a check) and its [data-copy-label] reads "Kopierat"
      for a beat. The original label is remembered once and the timer resets
      on repeat clicks, so rapid clicks can't leave it stuck on "Kopierat". */
const armCopy = (el: HTMLElement, value: () => string, done: string, ms: number) => {
  const label = el.querySelector<HTMLElement>('[data-copy-label]');
  const original = label?.textContent ?? '';
  let timer = 0;
  el.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(value());
      el.classList.add('is-copied');
      if (label) label.textContent = done;
      clearTimeout(timer);
      timer = window.setTimeout(() => { el.classList.remove('is-copied'); if (label) label.textContent = original; }, ms);
    } catch { /* clipboard blocked — no-op */ }
  });
};
document.querySelectorAll<HTMLElement>('[data-copy]').forEach((el) => armCopy(el, () => el.dataset.copy!, 'Kopierat', 1400));
document.querySelectorAll<HTMLElement>('[data-copy-text]').forEach((el) => armCopy(el, () => el.dataset.copyText ?? '', el.dataset.copyDone ?? 'Kopierat', 1400));

/* 4. Print / "Spara som PDF". */
document.querySelectorAll('[data-print]').forEach((btn) =>
  btn.addEventListener('click', () => window.print())
);

/* 5. Mobile nav toggle. */
document.querySelectorAll<HTMLElement>('[data-nav]').forEach((nav) => {
  const toggle = nav.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  if (!toggle) return;
  const setOpen = (open: boolean) => {
    nav.setAttribute('data-open', String(open));
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setOpen(nav.getAttribute('data-open') !== 'true'));
  nav.querySelectorAll('.nav__link').forEach((l) => l.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.getAttribute('data-open') === 'true') setOpen(false);
  });
});

/* Measure the drawer footer's natural height into --foot-h, so it collapses from
   a real pixel value. Animating a max-height overshoot looks janky (dead time
   while max-height falls to the content height, then a snap); a real height
   animates evenly and stays in lockstep with the width collapse. */
document.querySelectorAll<HTMLElement>('.nav__foot').forEach((foot) => {
  const inner = foot.querySelector<HTMLElement>('.nav__foot-inner');
  if (!inner) return;
  const measure = () => foot.style.setProperty('--foot-h', `${inner.offsetHeight}px`);
  measure();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(inner);
  else window.addEventListener('resize', measure, { passive: true });
});

/* 6. Cmd+K quick search — a command palette that indexes sections and key
      content (colours, typefaces, tone principles, platform blocks) from the DOM,
      so it stays in sync with whatever the profile ships. Pure enhancement:
      exists only with JS; the book is fully navigable without it. */
(() => {
  interface Entry { label: string; kind: string; extra?: string; node: HTMLElement; }

  const sectionTitle = (el: HTMLElement): string => {
    const sec = el.closest('section[id]');
    return sec?.querySelector('.section__title')?.textContent?.trim() ?? '';
  };
  const firstTextOnly = (el: Element | null): string => {
    if (!el) return '';
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) return n.textContent.trim();
    }
    return el.textContent?.trim() ?? '';
  };

  const index: Entry[] = [];
  document.querySelectorAll<HTMLElement>('section[id]').forEach((sec) => {
    const label = sec.querySelector('.section__title')?.textContent?.trim();
    if (label) index.push({ label, kind: 'Sektion', node: sec });
  });
  document.querySelectorAll<HTMLElement>('[data-chapter]').forEach((ch) => {
    const label = ch.querySelector('.chapter__title')?.textContent?.trim();
    if (label) index.push({ label, kind: 'Kapitel', node: ch });
  });
  const add = (sel: string, kindFallback: string, label: (el: HTMLElement) => string, extra?: (el: HTMLElement) => string | undefined) => {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      const l = label(el);
      if (l) index.push({ label: l, kind: sectionTitle(el) || kindFallback, extra: extra?.(el), node: el });
    });
  };
  add('button.cg-card', 'Färg', (el) => el.querySelector('.cg-card__name')?.textContent?.trim() ?? '', (el) => el.getAttribute('data-copy') ?? undefined);
  add('.type', 'Typografi', (el) => el.querySelector('.type__name')?.textContent?.trim() ?? '');
  add('.logo', 'Logotyp', (el) => el.querySelector('.logo__name')?.textContent?.trim() ?? '');
  add('.platform__block', 'Plattform', (el) => el.querySelector('.platform__title')?.textContent?.trim() ?? '');
  add('.tone__principle', 'Tonalitet', (el) => el.querySelector('.tone__name')?.textContent?.trim() ?? '');
  add('.dl-group', 'Nedladdning', (el) => el.querySelector('.dl-group__title')?.textContent?.trim() ?? '');

  if (!index.length) return;

  // Fuzzy score: substring hits rank highest, then in-order subsequence.
  const score = (q: string, text: string): number => {
    const t = text.toLowerCase();
    const idx = t.indexOf(q);
    if (idx === 0) return 1000 - text.length;
    if (idx > 0) return 700 - idx - text.length;
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) if (t[i] === q[qi]) qi++;
    return qi === q.length ? 300 - text.length : -1;
  };

  // Build the overlay.
  const overlay = document.createElement('div');
  overlay.className = 'cmdk';
  overlay.setAttribute('hidden', '');
  overlay.innerHTML = `
    <div class="cmdk__backdrop" data-cmdk-close></div>
    <div class="cmdk__panel" role="dialog" aria-modal="true" aria-label="Sök">
      <div class="cmdk__inputrow">
        <svg class="cmdk__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input class="cmdk__input" type="text" autocomplete="off" spellcheck="false" placeholder="${'Sök i varumärket…'}" aria-label="Sök" />
        <kbd class="cmdk__esc">Esc</kbd>
      </div>
      <ul class="cmdk__list" role="listbox"></ul>
      <p class="cmdk__empty" hidden>Inga träffar</p>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector<HTMLInputElement>('.cmdk__input')!;
  const list = overlay.querySelector<HTMLUListElement>('.cmdk__list')!;
  const empty = overlay.querySelector<HTMLElement>('.cmdk__empty')!;
  let results: Entry[] = [];
  let sel = 0;
  let lastFocus: HTMLElement | null = null;

  const render = (q: string) => {
    const query = q.trim().toLowerCase();
    results = query
      ? index.map((e) => ({ e, s: Math.max(score(query, e.label), score(query, e.kind) - 200) }))
          .filter((r) => r.s > -1).sort((a, b) => b.s - a.s).slice(0, 8).map((r) => r.e)
      : index.slice(0, 8);
    sel = 0;
    list.innerHTML = results.map((e, i) => `
      <li class="cmdk__item${i === 0 ? ' is-active' : ''}" role="option" data-i="${i}" aria-selected="${i === 0}">
        <span class="cmdk__label">${e.label.replace(/</g, '&lt;')}</span>
        <span class="cmdk__meta">${e.extra ? `<span class="cmdk__hex">${e.extra.replace(/</g, '&lt;')}</span>` : ''}<span class="cmdk__kind">${e.kind.replace(/</g, '&lt;')}</span></span>
      </li>`).join('');
    empty.hidden = results.length > 0;
  };

  const paintSel = () => {
    list.querySelectorAll<HTMLElement>('.cmdk__item').forEach((li, i) => {
      li.classList.toggle('is-active', i === sel);
      li.setAttribute('aria-selected', String(i === sel));
      if (i === sel) li.scrollIntoView({ block: 'nearest' });
    });
  };

  const open = () => {
    if (!overlay.hasAttribute('hidden')) return;
    lastFocus = document.activeElement as HTMLElement;
    overlay.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    input.value = '';
    render('');
    requestAnimationFrame(() => input.focus());
  };
  const close = () => {
    if (overlay.hasAttribute('hidden')) return;
    overlay.setAttribute('hidden', '');
    document.body.style.overflow = '';
    lastFocus?.focus?.();
  };
  const go = (e?: Entry) => {
    const target = e ?? results[sel];
    if (!target) return;
    close();
    target.node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    target.node.classList.add('search-flash');
    setTimeout(() => target.node.classList.remove('search-flash'), 1200);
  };

  input.addEventListener('input', () => render(input.value));
  overlay.querySelectorAll('[data-cmdk-close]').forEach((el) => el.addEventListener('click', close));
  list.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('.cmdk__item');
    if (li) { sel = Number(li.dataset.i); go(); }
  });
  list.addEventListener('mousemove', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('.cmdk__item');
    if (li && Number(li.dataset.i) !== sel) { sel = Number(li.dataset.i); paintSel(); }
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); paintSel(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); paintSel(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  document.querySelectorAll('[data-search-open]').forEach((b) => b.addEventListener('click', open));
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); overlay.hasAttribute('hidden') ? open() : close(); }
  });
})();

/* 7. Nav hover "tick" — a small, dry relay click (turn-signal blinker) synthesised
      with Web Audio, so there's no audio file and no dependency. Shipped opt-out:
      on by default, but there's a mute toggle in the drawer footer, and it only
      fires for real pointers. Browsers block audio until the first user gesture,
      so we unlock the context on the first pointer/key press. */
(() => {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const toggleBtn = document.querySelector<HTMLButtonElement>('[data-sound-toggle]');

  let soundOn = true;
  try { soundOn = localStorage.getItem('nav-sound') !== 'off'; } catch { /* private mode */ }

  const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  let ctx: AudioContext | null = null;
  const unlock = () => {
    if (!AC) return;
    if (!ctx) { try { ctx = new AC(); } catch { return; } }
    if (ctx.state === 'suspended') ctx.resume();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  const tick = () => {
    if (!soundOn || !ctx) return;
    const t = ctx.currentTime;

    // LOW thump — the woody body of a real relay "tock"
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.05);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.13, t + 0.004);   // low freqs read quieter, so a bit louder
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(og).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.1);

    // wooden overtone — a touch of mid so it's a "tock", not a pure sub thud
    const osc2 = ctx.createOscillator();
    const og2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(520, t);
    osc2.frequency.exponentialRampToValueAtTime(300, t + 0.03);
    og2.gain.setValueAtTime(0.0001, t);
    og2.gain.exponentialRampToValueAtTime(0.04, t + 0.003);
    og2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc2.connect(og2).connect(ctx.destination);
    osc2.start(t); osc2.stop(t + 0.06);

    // mechanical click — short bandpassed noise, lower and quieter than before
    const len = Math.floor(ctx.sampleRate * 0.012);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.value = 0.035;
    src.connect(bp).connect(ng).connect(ctx.destination);
    src.start(t);
  };

  if (fine) {
    document.querySelectorAll('.nav__link').forEach((l) => l.addEventListener('mouseenter', tick));
  }

  if (toggleBtn) {
    const paint = () => {
      toggleBtn.setAttribute('aria-pressed', String(soundOn));
      toggleBtn.dataset.on = String(soundOn);
    };
    paint();
    toggleBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      try { localStorage.setItem('nav-sound', soundOn ? 'on' : 'off'); } catch { /* ignore */ }
      unlock();
      paint();
      if (soundOn) tick(); // preview the sound when turning it on
    });
  }
})();


/* 7. Colour guide — staggered reveals, "in use" marquees, stories slideshows.
      All progressive: without JS (or with reduced motion) the grids are simply
      visible, the marquee is a plain scroller, the stories show slide one. */

/* Stagger: any [data-stagger] grid fades its children in (30–80ms steps, per
   --i in the markup) the first time it scrolls into view. */
if (motion && 'IntersectionObserver' in window) {
  const staggerIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const grid = e.target as HTMLElement;
      grid.classList.add('is-in');
      staggerIO.unobserve(grid);
      // once everything has landed, drop the entrance transition so hover/press stay snappy
      const n = grid.children.length;
      window.setTimeout(() => grid.classList.add('is-done'), 700 + n * 60 + 50);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  document.querySelectorAll('[data-stagger]').forEach((g) => staggerIO.observe(g));
}

/* Marquee: one linear WAAPI animation per track (runs on the compositor), moving
   exactly one set's width so the duplicate set makes the loop seamless. Hovering
   a tile eases the playback rate down to a crawl; leaving eases it back. Paused
   while off screen. */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((wrap) => {
  const track = wrap.querySelector<HTMLElement>('[data-marquee-track]');
  if (!motion || !track || !('animate' in track)) return;
  const SPEED = 38;      // px per second at full speed
  const SLOW = 0.08;     // playback rate while hovering a tile
  let anim: Animation | null = null;
  const build = () => {
    const progress = anim && anim.effect ? (anim.currentTime as number ?? 0) / ((anim.effect.getTiming().duration as number) || 1) : 0;
    anim?.cancel();
    const half = track.scrollWidth / 2;
    if (half <= 0) return;
    anim = track.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-half}px)` }], {
      duration: (half / SPEED) * 1000, iterations: Infinity, easing: 'linear',
    });
    anim.currentTime = progress * (half / SPEED) * 1000;
    if (!visible) anim.pause();
  };
  let visible = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!anim) build();
    if (visible) anim?.play(); else anim?.pause();
  }).observe(wrap);
  if ('ResizeObserver' in window) {
    let w = track.scrollWidth;
    new ResizeObserver(() => { if (Math.abs(track.scrollWidth - w) > 1) { w = track.scrollWidth; build(); } }).observe(track);
  }

  // hover: tween playbackRate (fine pointers only — touch has no hover)
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let raf = 0;
  const tweenRate = (to: number, ms: number) => {
    cancelAnimationFrame(raf);
    if (!anim) return;
    const from = anim.playbackRate, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      anim?.updatePlaybackRate(from + (to - from) * easeOutCubic(k));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  track.querySelectorAll<HTMLElement>('[data-marquee-item]').forEach((item) => {
    item.addEventListener('pointerenter', () => tweenRate(SLOW, 450));
    item.addEventListener('pointerleave', () => tweenRate(1, 700));
  });
});

/* Stories: Instagram-style. Tap right = next, left = previous; drag/swipe;
   arrow keys when focused. Auto-advances while on screen (the active bar fills),
   pauses while a press is held or the tab is hidden. */
document.querySelectorAll<HTMLElement>('[data-stories]').forEach((root) => {
  const track = root.querySelector<HTMLElement>('[data-stories-track]');
  const slides = track ? Array.from(track.children) as HTMLElement[] : [];
  const bars = Array.from(root.querySelectorAll<HTMLElement>('.cg-stories__bar'));
  const counter = root.querySelector<HTMLElement>('[data-stories-index]');
  if (!track || slides.length < 2) return;
  const DURATION = 5000;
  let index = 0, elapsed = 0, last = 0, raf = 0, visible = false, held = false;

  const paintBars = () => bars.forEach((b, i) => {
    b.classList.toggle('is-done', i < index);
    const fill = b.firstElementChild as HTMLElement | null;
    if (fill && i >= index) fill.style.transform = i === index ? `scaleX(${Math.min(1, elapsed / DURATION)})` : 'scaleX(0)';
    if (fill && i < index) fill.style.transform = '';
  });
  const go = (to: number) => {
    index = (to + slides.length) % slides.length;
    elapsed = 0;
    track.style.transform = `translateX(${-index * 100}%)`;
    slides.forEach((s, i) => s.setAttribute('aria-hidden', String(i !== index)));
    if (counter) counter.textContent = String(index + 1);
    paintBars();
  };
  const tick = (now: number) => {
    if (last) elapsed += now - last;
    last = now;
    if (elapsed >= DURATION) go(index + 1); else paintBars();
    raf = requestAnimationFrame(tick);
  };
  const run = () => {
    cancelAnimationFrame(raf); last = 0;
    if (motion && visible && !held && !document.hidden) raf = requestAnimationFrame(tick);
  };

  root.querySelector('[data-stories-prev]')?.addEventListener('click', (e) => { if (!dragged) go(index - 1); e.preventDefault(); });
  root.querySelector('[data-stories-next]')?.addEventListener('click', (e) => { if (!dragged) go(index + 1); e.preventDefault(); });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { go(index + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { go(index - 1); e.preventDefault(); }
  });

  // hold to pause; drag to swipe (a short press is still a tap on the zones)
  let startX = 0, dx = 0, down = false, dragged = false;
  root.addEventListener('pointerdown', (e) => {
    down = true; dragged = false; startX = e.clientX; dx = 0; held = true; run();
  });
  root.addEventListener('pointermove', (e) => {
    if (!down) return;
    dx = e.clientX - startX;
    if (!dragged && Math.abs(dx) > 8) { dragged = true; track.classList.add('is-dragging'); root.setPointerCapture(e.pointerId); }
    if (dragged) track.style.transform = `translateX(calc(${-index * 100}% + ${dx}px))`;
  });
  const release = () => {
    if (!down) return;
    down = false; held = false;
    if (dragged) {
      track.classList.remove('is-dragging');
      const w = root.clientWidth || 1;
      if (Math.abs(dx) > w * 0.15) go(index + (dx < 0 ? 1 : -1)); else go(index);
      window.setTimeout(() => { dragged = false; }, 0);   // swallow the click that follows a drag
    }
    run();
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }, { threshold: 0.4 }).observe(root);
  document.addEventListener('visibilitychange', run);
  go(0);
});

/* 9. Why-dialog — clicking a greyed "Saknas" section in the sidebar explains
      what that section is for (copy from categories.ts via SideNav). */
(() => {
  const box = document.querySelector<HTMLDialogElement>('[data-whybox]');
  const raw = box?.querySelector('[data-why-copy]')?.textContent;
  if (!box || !raw || typeof box.showModal !== 'function') return;
  const copy = JSON.parse(raw) as Record<string, { label: string; n?: number; category?: string; missing?: string; why?: string }>;
  const set = (sel: string, text: string) => { const el = box.querySelector(sel); if (el) el.textContent = text; };
  document.querySelectorAll<HTMLElement>('[data-why]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const c = copy[btn.dataset.why!];
      if (!c) return;
      set('[data-why-kicker]', [c.n, c.category].filter(Boolean).join(' · '));
      set('[data-why-title]', c.label);
      set('[data-why-lead]', c.missing ? `Det ser ut som att er brandbook saknar ${c.missing}.` : '');
      set('[data-why-body]', c.why ?? '');
      box.showModal();
    });
  });
  box.querySelector('[data-why-close]')?.addEventListener('click', () => box.close());
  // a click outside the dialog's box (on the backdrop) closes it
  box.addEventListener('click', (e) => {
    const r = box.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) box.close();
  });
})();
