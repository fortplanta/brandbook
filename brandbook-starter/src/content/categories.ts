/* ----------------------------------------------------------------------------
   SIDEBAR STRUCTURE — categories group the sections. This is agency-controlled
   STRUCTURE, not per-client CONTENT, so it lives in the repo (not the CMS):
   the same category layout applies to every client, and a locked teaser is a
   structural decision. Content (colours, logos, copy…) comes from the CMS via
   loadProfile(). `sections` are section ids (see index.astro).
   -------------------------------------------------------------------------- */
export interface NavCategory {
  id: string;
  label: string;
  locked?: boolean;
  sections?: string[];
}

export const categories: NavCategory[] = [
  { id: 'karnan',   label: 'Kärnan',   sections: ['plattform'] },
  { id: 'rost',     label: 'Röst',     sections: ['tonalitet'] },
  { id: 'uttryck',  label: 'Uttryck',  sections: ['logos', 'colors', 'typography', 'imagery', 'motion'] },
  { id: 'ibruk',    label: 'I bruk',   locked: true },   // teaser — not part of this client's scope (yet)
  { id: 'material', label: 'Material', sections: ['downloads'] },
];
