/* ----------------------------------------------------------------------------
   TEMPLATE STRUCTURE — the full brandbook: 5 categories → 2–3 groups each →
   28 sections. This is agency-controlled STRUCTURE, not per-client CONTENT, so
   it lives in the repo (not the CMS). The same structure applies to every
   client.

   • Categories (I–V) open with a chapter hero.
   • Groups are non-clickable labels that break a category's sidebar list into
     scannable clusters (max 3 per category, max 6 sections per group).
   • Sections are the pages. Their numbers (1–28) are COMPUTED from this order,
     so reordering never leaves the numbering out of sequence.
   • Sidebar = progressive disclosure: an open category lists only its
     `primary` pages (the ones people open daily); the rest are one click away
     behind "+ N till", and appear in place, in page order. Groups are NOT shown
     in the sidebar — they're the columns of each chapter hero's contents.

   By default EVERY section renders: with its component when the client has
   content, otherwise as a placeholder describing what belongs there. What a
   given client actually shows is controlled per client in profile.ts
   (`visibility` + `hideEmpty`) — see resolveStructure() below.

   `id` is the section's anchor + DOM id; `about` is the section hero's default
   lede ("what goes here").
   -------------------------------------------------------------------------- */
export interface SectionDef {
  id: string;
  n: number;
  label: string;
  about: string;
  primary?: boolean;   // always visible in the sidebar; the rest sit behind "+ N till"
  inNav?: boolean;     // false = on the page, but not listed in the sidebar
}
export interface GroupDef {
  label: string;
  sections: SectionDef[];
}
export interface CategoryDef {
  id: string;
  label: string;
  intro: string;          // lede on the category's chapter hero
  groups: GroupDef[];
  sections: SectionDef[]; // all sections, flattened in order (derived)
}

type RawSection = Omit<SectionDef, 'n'>;
type RawCategory = { id: string; label: string; intro: string; groups: { label: string; sections: RawSection[] }[] };

const raw: RawCategory[] = [
  {
    id: 'varumarkesplattform', label: 'Varumärkesplattform',
    intro: 'Grunden. Vem varumärket är, vad det tror på och hur det låter — allt annat vilar på det här.',
    groups: [
      { label: 'Grund', sections: [
        { id: 'introduktion',   label: 'Introduktion',          about: 'Introduktion och hur dokumentet används.', primary: true },
        { id: 'vision-mission', label: 'Vision & mission',      about: 'Varumärkets vision och mission.' },
        { id: 'karnvarden',     label: 'Kärnvärden',            about: 'Kärnvärdena som styr hur varumärket agerar.', primary: true },
        { id: 'manifest',       label: 'Manifest',              about: 'Varumärkets manifest.' },
        { id: 'brand-story',    label: 'Brand story',           about: 'Ursprunget — varför varumärket finns.' },
      ] },
      { label: 'Marknad', sections: [
        { id: 'positionering',  label: 'Positionering',         about: 'Marknadsläge, målgrupp och en kort konkurrensbild.', primary: true },
        { id: 'malgrupper',     label: 'Målgrupper & personas', about: 'Målgrupper och personas, om relevant för kunden.' },
      ] },
      { label: 'Personlighet & röst', sections: [
        { id: 'personlighet',   label: 'Brand personality',     about: 'Varumärkets personlighet — arketyp(er).' },
        { id: 'tonalitet',      label: 'Tonalitet & röst',      about: 'Tonalitet och röst, med do’s och don’ts i copy.', primary: true },
      ] },
    ],
  },
  {
    id: 'visuell-identitet', label: 'Visuell identitet',
    intro: 'Det man ser. Logotyp, färg, typografi och bild — byggstenarna som gör varumärket igenkännbart.',
    groups: [
      { label: 'Grundelement', sections: [
        { id: 'logos',            label: 'Logotyp',              about: 'Primär och sekundär logotyp, skyddszon, minsta storlek och felaktig användning.', primary: true },
        { id: 'colors',           label: 'Färgpalett',           about: 'Primära och sekundära färger, tillgänglighetskontraster (WCAG) och värden för både digitalt och tryck.', primary: true },
        { id: 'typography',       label: 'Typografi',            about: 'Primärt och sekundärt typsnitt, hierarki, webbfonter vs tryckfonter och fallbacks.', primary: true },
        { id: 'layout-grid',      label: 'Layout & grid',        about: 'Gridsystem, marginaler och spacing-principer (spacing tokens är särskilt värdefullt digitalt).' },
      ] },
      { label: 'Bildvärld', sections: [
        { id: 'imagery',          label: 'Bildspråk & fotostil', about: 'Ton, komposition, gör och gör inte.', primary: true },
        { id: 'grafiska-element', label: 'Grafiska element',     about: 'Ikoner, mönster, texturer och dividers.' },
        { id: 'ikonografi',       label: 'Ikonografi',           about: 'Ikonernas stil och vikt.' },
        { id: 'illustration',     label: 'Illustrationsmanér',   about: 'Illustrationsmanér.' },
      ] },
    ],
  },
  {
    id: 'rorligt-ljud', label: 'Rörligt & ljud',
    intro: 'Det som rör sig och hörs. Hur identiteten beter sig i tid — animation, video och ljud.',
    groups: [
      { label: 'Rörelse', sections: [
        { id: 'motion', label: 'Rörlig identitet', about: 'Hur logotypen animeras, övergångar, hastighet och easing.', primary: true },
        { id: 'video',  label: 'Video-guidelines', about: 'Intro/outro och undertextformat per kanal.', primary: true },
      ] },
      { label: 'Ljud', sections: [
        { id: 'ljud-id', label: 'Ljud-ID', about: 'Ljudlogotyp/jingel och användningsregler.', primary: true },
      ] },
    ],
  },
  {
    id: 'tillampning', label: 'Tillämpning',
    intro: 'Identiteten i bruk. Hur byggstenarna möts på verkliga ytor — digitalt, i tryck och tillsammans med andra.',
    groups: [
      { label: 'Kanaler', sections: [
        { id: 'digitalt', label: 'Digitala applikationer', about: 'Webb, sociala mallar, UI-komponenter, diagram och datavisualisering.', primary: true },
        { id: 'print',    label: 'Print-applikationer',    about: 'Visitkort, brevpapper, roll-ups, materialspec m.m.', primary: true },
      ] },
      { label: 'Partners & produkter', sections: [
        { id: 'co-branding', label: 'Co-branding',             about: 'Regler för samexistens med partnerlogotyper.' },
        { id: 'merch',       label: 'Profilprodukter & merch', about: 'Profilprodukter och merch.' },
      ] },
      { label: 'Inspiration', sections: [
        { id: 'exempel', label: 'Exempel i verkligheten', about: 'Mockups som visar helheten i kontext.', primary: true },
      ] },
    ],
  },
  {
    id: 'resurser', label: 'Resurser & governance',
    intro: 'Allt som behövs för att använda varumärket rätt — filer, ansvar och historik.',
    groups: [
      { label: 'Filer', sections: [
        { id: 'downloads', label: 'Nedladdningsbara assets', about: 'Logotyppaket, fontlänkar och mallar.', primary: true },
      ] },
      { label: 'Förvaltning', sections: [
        { id: 'kontakt',          label: 'Kontakt & godkännande', about: 'Vem som äger varumärket och hur nya assets begärs.', primary: true },
        { id: 'versionshistorik', label: 'Versionshistorik',      about: 'Uppdateringslogg — ett digitalt mervärde som en PDF inte kan erbjuda.', inNav: false },
      ] },
    ],
  },
];

// Number the sections 1…n in reading order, and flatten each category.
let counter = 0;
export const categories: CategoryDef[] = raw.map((cat) => {
  const groups = cat.groups.map((g) => ({ label: g.label, sections: g.sections.map((s) => ({ ...s, n: ++counter })) }));
  return { ...cat, groups, sections: groups.flatMap((g) => g.sections) };
});

/** Section definitions by id (label, number, category, group, placeholder copy). */
export const sectionById = new Map(
  categories.flatMap((cat) => cat.groups.flatMap((g) => g.sections.map((s) => [s.id, { ...s, category: cat, group: g.label }] as const)))
);

/* ----------------------------------------------------------------------------
   Per-client visibility. Keys are SECTION or CATEGORY ids:
     • not listed  → shown (the default — the whole template is visible)
     • 'hidden'    → not in the sidebar, not on the page
     • 'locked'    → greyed, non-clickable teaser in the sidebar; not on the
                     page (an upsell cue: "should we do this part too?")
   `hideEmpty: true` additionally drops every section that has no content
   (no placeholders) — for a finished, client-facing book. A group whose
   sections are all gone disappears with them.
   -------------------------------------------------------------------------- */
export type Visibility = Record<string, 'hidden' | 'locked'>;

export interface ResolvedSection extends SectionDef { locked: boolean; filled: boolean; }
export interface ResolvedGroup { label: string; sections: ResolvedSection[]; }
export interface ResolvedCategory {
  id: string; label: string; intro: string; roman: string; locked: boolean;
  groups: ResolvedGroup[];
  sections: ResolvedSection[];   // flattened, in order
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function resolveStructure(
  filled: (id: string) => boolean,
  visibility: Visibility = {},
  hideEmpty = false,
): ResolvedCategory[] {
  return categories
    .map((cat, i) => ({ cat, roman: ROMAN[i] ?? String(i + 1) }))   // numeral is fixed by the template, not by what's shown
    .filter(({ cat }) => visibility[cat.id] !== 'hidden')
    .map(({ cat, roman }) => {
      const locked = visibility[cat.id] === 'locked';
      const groups = locked ? [] : cat.groups
        .map((g) => ({
          label: g.label,
          sections: g.sections
            .filter((s) => visibility[s.id] !== 'hidden')
            .map((s) => ({ ...s, locked: visibility[s.id] === 'locked', filled: filled(s.id) }))
            .filter((s) => s.locked || s.filled || !hideEmpty),
        }))
        .filter((g) => g.sections.length > 0);
      return { id: cat.id, label: cat.label, intro: cat.intro, roman, locked, groups, sections: groups.flatMap((g) => g.sections) };
    })
    .filter((cat) => cat.locked || cat.sections.length > 0);
}
