/**
 * Progressive enhancement — the only client JS. The book is fully readable
 * without it; this adds active-nav tracking, copy-to-clipboard, print, and the
 * mobile menu. No dependencies.
 */
document.documentElement.classList.add('js');

const supportsScrollTimeline =
  typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 1. Reveal fallback (only when native scroll timelines are missing). */
if (!supportsScrollTimeline && !reduceMotion) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      }
    },
    { rootMargin: '0px 0px -12% 0px' }
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

/* Accordion categories: measure each sub-list into --cat-h so it collapses from
   a real height; map each section to its category; wire the open/close toggles. */
const cats = Array.from(document.querySelectorAll<HTMLElement>('.cat'));
const sectionCat = new Map<string, HTMLElement>();

const setCatOpen = (cat: HTMLElement, open: boolean) => {
  if (cat.classList.contains('cat--locked')) return;
  cat.setAttribute('data-open', String(open));
  cat.querySelector('[data-cat-toggle]')?.setAttribute('aria-expanded', String(open));
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
});

// Re-enable transitions once the collapsed baseline has painted.
requestAnimationFrame(() => requestAnimationFrame(() => drawer?.classList.remove('nav--boot')));

const MINIMIZE_AT = 0.25; // fraction of one viewport scrolled before the rail collapses
const LINE = 0.32;        // active-section trigger line, as a fraction down the viewport
let currentId = '';
let ticking = false;

function onScroll() {
  ticking = false;
  if (drawer) drawer.toggleAttribute('data-min', window.scrollY > window.innerHeight * MINIMIZE_AT);

  if (links.size && sections.length) {
    const line = window.innerHeight * LINE;
    let activeId = sections[0].id;
    for (const s of sections) {
      if (s.getBoundingClientRect().top - line <= 0) activeId = s.id;
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
    }
  }
}
onScroll();
window.addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });

/* 3. Copy-to-clipboard on colour swatches. */
document.querySelectorAll<HTMLElement>('[data-copy]').forEach((el) => {
  el.addEventListener('click', async () => {
    const value = el.dataset.copy!;
    try {
      await navigator.clipboard.writeText(value);
      el.classList.add('is-copied');             // flips the copy icon to a check
      const label = el.querySelector<HTMLElement>('[data-copy-label]');
      const prev = label?.textContent ?? null;
      if (label) { label.textContent = 'Kopierat'; label.classList.add('swatch__copied'); }
      setTimeout(() => {
        el.classList.remove('is-copied');
        if (label) { label.textContent = prev; label.classList.remove('swatch__copied'); }
      }, 1100);
    } catch { /* clipboard blocked — no-op */ }
  });
});

/* 3b. Copy arbitrary text (design-token export buttons). Swaps the button label
      to a confirmation for a beat; no layout shift (min-width holds the width). */
document.querySelectorAll<HTMLElement>('[data-copy-text]').forEach((el) => {
  const original = el.textContent;
  el.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(el.dataset.copyText ?? '');
      el.classList.add('is-copied');
      el.textContent = el.dataset.copyDone ?? 'Kopierat';
      setTimeout(() => { el.classList.remove('is-copied'); el.textContent = original; }, 1200);
    } catch { /* clipboard blocked — no-op */ }
  });
});

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
  const add = (sel: string, kindFallback: string, label: (el: HTMLElement) => string, extra?: (el: HTMLElement) => string | undefined) => {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      const l = label(el);
      if (l) index.push({ label: l, kind: sectionTitle(el) || kindFallback, extra: extra?.(el), node: el });
    });
  };
  add('.swatch', 'Färg', (el) => firstTextOnly(el.querySelector('.swatch__name')), (el) => el.getAttribute('data-copy') ?? undefined);
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
