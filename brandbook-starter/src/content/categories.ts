/* ----------------------------------------------------------------------------
   TEMPLATE STRUCTURE — the full brandbook: 5 categories, 28 numbered sections.
   This is agency-controlled STRUCTURE, not per-client CONTENT, so it lives in
   the repo (not the CMS). The same structure applies to every client.

   By default EVERY section renders: with its component when the client has
   content, otherwise as a placeholder describing what belongs there. What a
   given client actually shows is controlled per client in profile.ts
   (`visibility` + `hideEmpty`) — see resolveStructure() below.

   `id` is the section's anchor + DOM id; `about` is the "what goes here" copy
   shown on placeholders.
   -------------------------------------------------------------------------- */
export interface SectionDef {
  id: string;
  n: number;
  label: string;
  about: string;
}
export interface CategoryDef {
  id: string;
  label: string;
  sections: SectionDef[];
}

export const categories: CategoryDef[] = [
  {
    id: 'varumarkesplattform', label: 'Varumärkesplattform', sections: [
      { id: 'introduktion',   n: 1,  label: 'Introduktion',          about: 'Introduktion och hur dokumentet används.' },
      { id: 'vision-mission', n: 2,  label: 'Vision & mission',      about: 'Varumärkets vision och mission.' },
      { id: 'karnvarden',     n: 3,  label: 'Kärnvärden',            about: 'Kärnvärdena som styr hur varumärket agerar.' },
      { id: 'manifest',       n: 4,  label: 'Manifest',              about: 'Varumärkets manifest.' },
      { id: 'positionering',  n: 5,  label: 'Positionering',         about: 'Marknadsläge, målgrupp och en kort konkurrensbild.' },
      { id: 'personlighet',   n: 6,  label: 'Brand personality',     about: 'Varumärkets personlighet — arketyp(er).' },
      { id: 'tonalitet',      n: 7,  label: 'Tonalitet & röst',      about: 'Tonalitet och röst, med do’s och don’ts i copy.' },
      { id: 'brand-story',    n: 8,  label: 'Brand story',           about: 'Ursprunget — varför varumärket finns.' },
      { id: 'malgrupper',     n: 9,  label: 'Målgrupper / personas', about: 'Målgrupper och personas, om relevant för kunden.' },
    ],
  },
  {
    id: 'visuell-identitet', label: 'Visuell identitet', sections: [
      { id: 'logos',            n: 10, label: 'Logotyp',              about: 'Primär och sekundär logotyp, skyddszon, minsta storlek och felaktig användning.' },
      { id: 'colors',           n: 11, label: 'Färgpalett',           about: 'Primära och sekundära färger, tillgänglighetskontraster (WCAG) och värden för både digitalt och tryck.' },
      { id: 'typography',       n: 12, label: 'Typografi',            about: 'Primärt och sekundärt typsnitt, hierarki, webbfonter vs tryckfonter och fallbacks.' },
      { id: 'grafiska-element', n: 13, label: 'Grafiska element',     about: 'Ikoner, mönster, texturer och dividers.' },
      { id: 'imagery',          n: 14, label: 'Bildspråk / fotostil', about: 'Ton, komposition, gör och gör inte.' },
      { id: 'layout-grid',      n: 15, label: 'Layout & grid',        about: 'Gridsystem, marginaler och spacing-principer (spacing tokens är särskilt värdefullt digitalt).' },
      { id: 'ikonografi',       n: 16, label: 'Ikonografi',           about: 'Ikonernas stil och vikt.' },
      { id: 'illustration',     n: 17, label: 'Illustrationsmanér',   about: 'Illustrationsmanér.' },
    ],
  },
  {
    id: 'rorligt-ljud', label: 'Rörligt & ljud', sections: [
      { id: 'motion', n: 18, label: 'Rörlig identitet', about: 'Hur logotypen animeras, övergångar, hastighet och easing.' },
      { id: 'video',  n: 19, label: 'Video-guidelines', about: 'Intro/outro och undertextformat per kanal.' },
      { id: 'ljud-id', n: 20, label: 'Ljud-ID',         about: 'Ljudlogotyp/jingel och användningsregler.' },
    ],
  },
  {
    id: 'tillampning', label: 'Tillämpning', sections: [
      { id: 'digitalt',    n: 21, label: 'Digitala applikationer', about: 'Webb, sociala mallar, UI-komponenter, diagram och datavisualisering.' },
      { id: 'print',       n: 22, label: 'Print-applikationer',    about: 'Visitkort, brevpapper, roll-ups, materialspec m.m.' },
      { id: 'co-branding', n: 23, label: 'Co-branding',            about: 'Regler för samexistens med partnerlogotyper.' },
      { id: 'merch',       n: 24, label: 'Profilprodukter / merch', about: 'Profilprodukter och merch.' },
      { id: 'exempel',     n: 25, label: 'Exempel i verkligheten', about: 'Mockups som visar helheten i kontext.' },
    ],
  },
  {
    id: 'resurser', label: 'Resurser & governance', sections: [
      { id: 'downloads',        n: 26, label: 'Nedladdningsbara assets', about: 'Logotyppaket, fontlänkar och mallar.' },
      { id: 'kontakt',          n: 27, label: 'Kontakt & godkännande',   about: 'Vem som äger varumärket och hur nya assets begärs.' },
      { id: 'versionshistorik', n: 28, label: 'Versionshistorik',        about: 'Uppdateringslogg — ett digitalt mervärde som en PDF inte kan erbjuda.' },
    ],
  },
];

/** Section definitions by id (label, number, category, placeholder copy). */
export const sectionById = new Map(
  categories.flatMap((cat) => cat.sections.map((s) => [s.id, { ...s, category: cat }] as const))
);

/* ----------------------------------------------------------------------------
   Per-client visibility. Keys are SECTION or CATEGORY ids:
     • not listed  → shown (the default — the whole template is visible)
     • 'hidden'    → not in the sidebar, not on the page
     • 'locked'    → greyed, non-clickable teaser in the sidebar; not on the
                     page (an upsell cue: "should we do this part too?")
   `hideEmpty: true` additionally drops every section that has no content
   (no placeholders) — for a finished, client-facing book.
   -------------------------------------------------------------------------- */
export type Visibility = Record<string, 'hidden' | 'locked'>;

export interface ResolvedSection extends SectionDef { locked: boolean; filled: boolean; }
export interface ResolvedCategory { id: string; label: string; locked: boolean; sections: ResolvedSection[]; }

export function resolveStructure(
  filled: (id: string) => boolean,
  visibility: Visibility = {},
  hideEmpty = false,
): ResolvedCategory[] {
  return categories
    .filter((cat) => visibility[cat.id] !== 'hidden')
    .map((cat) => {
      const locked = visibility[cat.id] === 'locked';
      const sections = locked ? [] : cat.sections
        .filter((s) => visibility[s.id] !== 'hidden')
        .map((s) => ({ ...s, locked: visibility[s.id] === 'locked', filled: filled(s.id) }))
        .filter((s) => s.locked || s.filled || !hideEmpty);
      return { id: cat.id, label: cat.label, locked, sections };
    })
    .filter((cat) => cat.locked || cat.sections.length > 0);
}
