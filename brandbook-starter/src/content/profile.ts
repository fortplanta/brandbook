/* ============================================================================
   THE CONTENT MODEL
   One deployment = one client. Everything the brandbook shows comes from this
   single object + the `categories` list below.

   SCALE FROM TINY TO HUGE, TWO WAYS:
   - A section with no content simply doesn't render.
   - A CATEGORY controls whether a whole group shows, hides, or teases:
       • omit it from `categories`      → hidden (a clean, minimal brandbook)
       • include it, no `locked`         → active & expandable
       • include it with `locked: true`  → greyed, non-clickable teaser in the
         sidebar (an upsell cue: "should we have done the rest too?")
   ========================================================================== */

export interface DownloadFile { label: string; href: string; size?: string; }

export interface Logo {
  name: string; note?: string; onDark?: boolean; image: string; files: DownloadFile[];
}
export interface Color {
  name: string; hex: string; rgb?: string; cmyk?: string; pantone?: string; role?: string;
}
export interface Typeface {
  name: string; role?: string; stack: string; weights?: string; note?: string; specimen?: string; files?: DownloadFile[];
}
export interface MotionItem { title: string; note?: string; src: string; poster?: string; }
export interface ImageItem { src: string; caption?: string; }
export interface DownloadGroup { group: string; items: DownloadFile[]; }
/* "Living document" — a short change log; the page is always the latest version,
   and this makes that visible (the edge over a PDF someone downloaded months ago). */
export interface ChangeEntry { date: string; note: string; }

/* Kärnan */
export interface PlatformBlock { title: string; body: string; }
/* Röst */
export interface TonePrinciple { name: string; description: string; do?: string; dont?: string; }
export interface Tone { intro?: string; principles: TonePrinciple[]; boilerplate?: string; }

export interface Profile {
  client: string;
  tagline?: string;
  updated?: string;
  accent?: string;
  cover?: { note?: string; background?: string };
  downloadAllHref?: string;

  platform: PlatformBlock[];      // Kärnan
  tone?: Tone;                    // Röst
  logos: Logo[];
  colors: Color[];
  typography: Typeface[];
  imagery: { note?: string; images: ImageItem[] };
  motion: MotionItem[];
  downloads: DownloadGroup[];
  changelog?: ChangeEntry[];      // optional; shows a "living document" history
}

/* The sidebar structure (categories) moved to ./categories.ts — it's agency
   structure, not per-client content. Re-export so existing imports still work. */
export { categories, type NavCategory } from './categories';

/* ----------------------------------------------------------------------------
   PROFILE — the LOCAL fallback content (used when no CMS is configured).
   Populated from the "Tangent Technologies" Figma file as a test.
   Colours + typeface + positioning copy are the real items from that file.
   Logo/imagery are PLACEHOLDERS (the Figma asset host is unreachable from here)
   — replace `public/assets/logos/*` and `public/assets/imagery/*` with the real
   exports. Tone-of-voice and motion aren't in the source file, so those two
   sections are omitted and their categories (Röst) simply don't render.
   Note: UI chrome is Swedish by default (src/lib/strings.ts) while this brand's
   content is English — flip strings.ts to English for an all-English deploy.
   -------------------------------------------------------------------------- */
export const profile: Profile = {
  client: 'Tangent Technologies',
  tagline: 'We partner with companies to optimize operational execution using our purpose-built agentic platform.',
  updated: '2026-09-17',
  accent: '#0B78DE',
  cover: {
    note: 'The whole Tangent brand in one place — logo, colours, type and files. Share the link internally; everyone works from the same source, always the latest version.',
  },
  downloadAllHref: '/assets/tangent-brand-assets.zip',

  platform: [
    { title: 'Idea', body: 'Companies now run on intelligence. Tangent makes that shift usable — a purpose-built agentic platform that turns operational complexity into executed work.' },
    { title: 'Positioning', body: 'We partner with companies to optimize operational execution using our purpose-built agentic platform.' },
    { title: 'Why teams choose Tangent', body: 'Not another dashboard. Agents that do the operational work, wired into how a company already runs — measurable in throughput, not promises.' },
  ],

  logos: [
    {
      name: 'Primary logo',
      note: 'Wordmark + symbol lockup. First choice. Keep clear space of at least the symbol height around it. (Placeholder — replace with the Figma export.)',
      image: '/assets/logos/tangent-wordmark.svg',
      files: [
        { label: 'SVG', href: '/assets/logos/tangent-wordmark.svg', size: '3 KB' },
      ],
    },
    {
      name: 'Symbol',
      note: 'The mark alone — for app icons, favicons and small surfaces. Not a standalone sender in external comms. (Placeholder — replace with the Figma export.)',
      onDark: true,
      image: '/assets/logos/tangent-symbol.svg',
      files: [{ label: 'SVG', href: '/assets/logos/tangent-symbol.svg', size: '2 KB' }],
    },
  ],

  colors: [
    { name: 'Sky',    hex: '#6BB4F8', rgb: '107 180 248', role: 'Light accent' },
    { name: 'Azure',  hex: '#238FF4', rgb: '35 143 244',  role: 'Accent' },
    { name: 'Signal', hex: '#0B78DE', rgb: '11 120 222',  role: 'Primary' },
    { name: 'Deep',   hex: '#06437C', rgb: '6 67 124',    role: 'Dark blue' },
    { name: 'Navy',   hex: '#042D54', rgb: '4 45 84',     role: 'Deep' },
    { name: 'Ink',    hex: '#010A13', rgb: '1 10 19',     role: 'Bakgrund' },
    { name: 'Sand',   hex: '#FADF93', rgb: '250 223 147', role: 'Warm accent' },
    { name: 'Mint',   hex: '#A5D9CB', rgb: '165 217 203', role: 'Cool accent' },
    { name: 'Black',  hex: '#000000', rgb: '0 0 0',       role: 'Contrast' },
  ],

  typography: [
    {
      name: 'General Sans', role: 'Display', stack: '"General Sans", "Helvetica Neue", Arial, sans-serif', weights: 'Medium, Semibold, Bold',
      note: 'Headlines and lead statements. Set tight, with slightly negative tracking at large sizes. (Add the General Sans webfont/files for the real specimen — Fontshare.)',
      specimen: 'Companies now run on intelligence.',
    },
    {
      name: 'General Sans', role: 'Text', stack: '"General Sans", "Helvetica Neue", Arial, sans-serif', weights: 'Regular, Medium',
      note: 'Body copy and interface. One family across the system — neutral, robust, technical.',
      specimen: 'We partner with companies to optimize operational execution.',
    },
  ],

  imagery: {
    note: 'Architectural, dark, product-forward. Deep blues and glass, agentic UI in context. (Placeholders — replace with the real mockups from Figma.)',
    images: [
      { src: '/assets/imagery/mock-signage.svg', caption: 'Building signage' },
      { src: '/assets/imagery/mock-product.svg', caption: 'Product UI in context' },
      { src: '/assets/imagery/mock-app.svg',     caption: 'Application icon' },
    ],
  },

  motion: [],

  downloads: [
    { group: 'Logos', items: [{ label: 'All logos (SVG)', href: '/assets/tangent-brand-assets.zip', size: '3 KB' }] },
    { group: 'Typefaces', items: [
      { label: 'General Sans (Fontshare)', href: 'https://www.fontshare.com/fonts/general-sans', size: '—' },
    ] },
  ],

  changelog: [
    { date: '2026-09-17', note: 'Brand imported from Figma — palette, General Sans and positioning copy.' },
    { date: '2026-09-17', note: 'Logo and imagery are placeholders pending real asset exports.' },
  ],
};
