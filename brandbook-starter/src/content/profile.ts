/* ============================================================================
   THE CONTENT MODEL
   One deployment = one client. The STRUCTURE (5 categories, 28 numbered
   sections) is fixed in ./categories.ts; this object is the client's CONTENT
   plus what to show of that structure.

   WHAT SHOWS — granular, per client:
   - Default: every section renders; one without content shows a placeholder.
   - `visibility`: per section OR category id → 'hidden' (gone) or 'locked'
     (greyed, non-clickable teaser in the sidebar — an upsell cue).
   - `hideEmpty: true`: drop every section without content (no placeholders).
   ========================================================================== */
import type { Visibility } from './categories';

export interface DownloadFile { label: string; href: string; size?: string; }

export interface Logo {
  name: string; note?: string; onDark?: boolean; image: string; files: DownloadFile[];
  transparent?: boolean;   // transparent background (from the CMS) — can be recoloured (mono/negative)
}
/* 11 Färgpalett — the colour guide. Colours are defined once in `colors`; the
   guide references them BY NAME (or a raw hex) and adds the structure: palettes,
   combinations, tints, colour in context and misuse. Media is optional
   everywhere: an item without `src` renders a poster generated from the
   palette, so the section looks designed before real photography exists. */
export interface Poster {
  bg: string;                       // colour name or hex
  fg: string;                       // colour name or hex
  text?: string;                    // defaults to the client's tagline
  kind?: 'statement' | 'figure' | 'shape' | 'split';
}
export interface MediaItem {
  src?: string;                     // image, or video if it ends in .mp4/.webm
  alt?: string;
  caption?: string;                 // small label on the tile
  poster?: Poster;                  // used when there's no src
}
export interface InUse { title: string; body?: string; media: MediaItem[] }
export interface Palette { title: string; body?: string; colors: string[]; inUse?: InUse }
export interface ColorPair { bg: string; fg: string; note?: string }
export interface ContextStage { label: string; body?: string; slides: MediaItem[] }
export type MisuseDemo = 'contrast' | 'gradient' | 'off-palette' | 'too-many' | 'proportion' | 'accent-text';
export interface MisuseItem { caption: string; media?: MediaItem; demo?: MisuseDemo }
export interface ColorGuide {
  hero?: { title?: string; lede?: string; media?: MediaItem };
  intro?: { lead: string; body?: string; media?: MediaItem };
  palettes: Palette[];
  combinations?: { title?: string; body?: string; pairs: ColorPair[]; slides?: MediaItem[] };
  tints?: { title?: string; body?: string; colors?: string[] };   // default: the first palette
  context?: { title?: string; body?: string; stages: ContextStage[] };
  misuse?: { title?: string; body?: string; items: MisuseItem[] };
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

/* 6 Positionering */
export interface PlatformBlock { title: string; body: string; }
/* 9 Tonalitet & röst */
export interface TonePrinciple { name: string; description: string; do?: string; dont?: string; }
export interface Tone { intro?: string; principles: TonePrinciple[]; boilerplate?: string; }

/* Filled from the CMS drop zone (image analysis): mockups by kind, palette
   artwork, graphic elements. Local profiles can use them too. */
export type ApplicationKind = 'digital' | 'print' | 'environment' | 'merch' | 'example';
export interface Application { src: string; kind: ApplicationKind; caption?: string }
export interface ColorInUseItem { src: string; caption?: string; colors?: string }
export interface GraphicItem { src: string; caption?: string }

export interface Profile {
  client: string;
  tagline?: string;
  updated?: string;
  accent?: string;
  cover?: { note?: string; background?: string };
  downloadAllHref?: string;

  platform: PlatformBlock[];      // 6 Positionering
  tone?: Tone;                    // 9 Tonalitet & röst
  logos: Logo[];
  colors: Color[];
  colorGuide?: ColorGuide;        // 11 — structure for the colour section (see above)
  typography: Typeface[];
  imagery: { note?: string; images: ImageItem[] };
  motion: MotionItem[];
  applications?: Application[];   // 21–25 Tillämpning (by kind)
  colorInUse?: ColorInUseItem[];   // 11 — the palette in use (feeds the colour section)
  graphics?: GraphicItem[];        // 15 Grafiska element
  downloads: DownloadGroup[];
  changelog?: ChangeEntry[];      // optional; shows a "living document" history

  visibility?: Visibility;        // per section/category: 'hidden' | 'locked'
  hideEmpty?: boolean;            // true → no placeholders for empty sections
}

/* The template structure lives in ./categories.ts — it's agency structure, not
   per-client content. Re-exported for convenience. */
export { categories, type CategoryDef, type SectionDef } from './categories';

/* ----------------------------------------------------------------------------
   PROFILE — the LOCAL fallback content (used when no CMS is configured).
   Populated from the "Tangent Technologies" Figma file as a test.
   Colours + typeface + positioning copy are the real items from that file.
   Logo/imagery are PLACEHOLDERS (the Figma asset host is unreachable from here)
   — replace `public/assets/logos/*` and `public/assets/imagery/*` with the real
   exports. Tone-of-voice and motion aren't in the source file, so those
   sections (and every other unfilled one) show as placeholders.
   Note: UI chrome is Swedish by default (src/lib/strings.ts) while this brand's
   content is English — flip strings.ts to English for an all-English deploy.
   -------------------------------------------------------------------------- */
export const profile: Profile = {
  client: 'Tangent Technologies',
  tagline: 'We partner with companies to optimize operational execution using our purpose-built agentic platform.',
  updated: '2026-09-19',
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

  colorGuide: {
    hero: {
      lede: 'Signal blue leads, deep navy grounds it and two warm accents keep it human. One palette, from app icon to building signage.',
    },
    intro: {
      lead: 'It starts with Signal — a blue that reads as clarity. Around it, a palette built to stay calm while the work gets done.',
      body: 'The primary palette carries every surface of the brand. The secondary palette adds range for product, campaigns and data — always in support of the primary, never instead of it.',
      media: { poster: { bg: 'Navy', fg: 'Sky', kind: 'statement' }, caption: 'Signal on Navy' },
    },
    palettes: [
      {
        title: 'Primärpalett',
        body: 'Signal, Navy and Ink carry the brand. Together they cover every background, every headline and every button — a restrained base that makes Tangent instantly recognisable.',
        colors: ['Signal', 'Navy', 'Ink'],
        inUse: {
          title: 'Primärpaletten i bruk',
          body: 'Keep it simple. A Signal, Navy or Ink background with type from the same palette gives a clean, distinctly Tangent look.',
          media: [
            { poster: { bg: 'Signal', fg: 'Ink', kind: 'statement' } },
            { src: '/assets/imagery/mock-product.svg', caption: 'Produkt' },
            { poster: { bg: 'Ink', fg: 'Signal', kind: 'figure', text: '24/7' } },
            { poster: { bg: 'Navy', fg: 'Sky', kind: 'shape' } },
            { src: '/assets/imagery/mock-signage.svg', caption: 'Skyltning' },
            { poster: { bg: 'Signal', fg: 'Navy', kind: 'split' } },
          ],
        },
      },
      {
        title: 'Sekundärpalett',
        body: 'Lighter blues for depth and hierarchy, Sand and Mint for warmth. Use them to separate, highlight and illustrate — in smaller doses than the primary palette.',
        colors: ['Sky', 'Azure', 'Deep', 'Sand', 'Mint', 'Black'],
        inUse: {
          title: 'Sekundärpaletten i bruk',
          body: 'Secondary colours work best as blocks and accents on a primary background — in product states, charts and campaign details.',
          media: [
            { poster: { bg: 'Sand', fg: 'Navy', kind: 'statement' } },
            { poster: { bg: 'Mint', fg: 'Ink', kind: 'figure', text: '98%' } },
            { src: '/assets/imagery/mock-app.svg', caption: 'App' },
            { poster: { bg: 'Sky', fg: 'Navy', kind: 'shape' } },
            { poster: { bg: 'Deep', fg: 'Sand', kind: 'split' } },
          ],
        },
      },
    ],
    combinations: {
      title: 'Godkända kombinationer',
      body: 'These pairs are tested for contrast and character. Background first, type second — stay within them and any layout reads as Tangent.',
      pairs: [
        { bg: 'Ink', fg: 'Sky' }, { bg: 'Signal', fg: 'Ink' }, { bg: 'Sand', fg: 'Navy' },
        { bg: 'Mint', fg: 'Ink' }, { bg: 'Navy', fg: 'Sand' }, { bg: 'Sky', fg: 'Navy' },
      ],
      slides: [
        { poster: { bg: 'Ink', fg: 'Sky', kind: 'statement' }, caption: 'Ink · Sky' },
        { poster: { bg: 'Sand', fg: 'Navy', kind: 'figure', text: '3×' }, caption: 'Sand · Navy' },
        { poster: { bg: 'Signal', fg: 'Ink', kind: 'shape' }, caption: 'Signal · Ink' },
        { poster: { bg: 'Mint', fg: 'Ink', kind: 'split' }, caption: 'Mint · Ink' },
      ],
    },
    tints: {
      body: 'For interfaces, charts and dense layouts, each primary colour extends into a scale. Use tints for states and surfaces — never as a replacement for the full colour.',
    },
    context: {
      body: 'The palette flexes with the situation: bold and primary where the brand introduces itself, lighter and more functional the closer people get to the product.',
      stages: [
        {
          label: 'Digitalt',
          body: 'Web and product lean on Ink and Navy surfaces with Signal for action. Secondary colours mark states and data.',
          slides: [
            { src: '/assets/imagery/mock-product.svg', caption: 'Produktgränssnitt' },
            { poster: { bg: 'Ink', fg: 'Signal', kind: 'figure', text: '+18%' }, caption: 'Dashboard' },
            { poster: { bg: 'Navy', fg: 'Sky', kind: 'statement' }, caption: 'Webb' },
          ],
        },
        {
          label: 'Print',
          body: 'In print, large Signal fields and generous white space. Sand and Mint only as accents.',
          slides: [
            { poster: { bg: 'Signal', fg: 'Ink', kind: 'statement' }, caption: 'Affisch' },
            { poster: { bg: 'Sand', fg: 'Navy', kind: 'split' }, caption: 'Broschyr' },
          ],
        },
        {
          label: 'Miljö',
          body: 'Signage and spaces are dark and architectural — Ink and Navy with Signal as the single point of light.',
          slides: [
            { src: '/assets/imagery/mock-signage.svg', caption: 'Skyltning' },
            { poster: { bg: 'Ink', fg: 'Signal', kind: 'shape' }, caption: 'Entré' },
          ],
        },
      ],
    },
    misuse: {
      body: 'The palette is flexible — within limits. Follow these so the brand stays consistent and legible.',
      items: [
        { demo: 'contrast', caption: 'Kombinera inte färger med för låg kontrast.' },
        { demo: 'gradient', caption: 'Skapa inte gradienter mellan varumärkesfärgerna.' },
        { demo: 'off-palette', caption: 'Introducera inte färger utanför paletten.' },
        { demo: 'too-many', caption: 'Använd inte för många färger samtidigt.' },
        { demo: 'proportion', caption: 'Låt inte accentfärgerna ta över primärpaletten.' },
        { demo: 'accent-text', caption: 'Sätt inte text i accentfärger på accentfärger.' },
      ],
    },
  },

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

  // What to show of the template. Default: all 28 sections, empty ones as
  // placeholders. Examples:
  //   visibility: { 'ljud-id': 'hidden', tillampning: 'locked' },
  //   hideEmpty: true,   // client-facing: only sections with content

  changelog: [
    { date: '2026-09-19', note: 'Live stress-test — this line was edited, rebuilt and pushed to the live page to prove the update loop.' },
    { date: '2026-09-17', note: 'Brand imported from Figma — palette, General Sans and positioning copy.' },
    { date: '2026-09-17', note: 'Logo and imagery are placeholders pending real asset exports.' },
  ],
};
