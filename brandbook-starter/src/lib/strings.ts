/* UI strings — all chrome copy in one place. Swedish by default (matches the
   Oh My brief); swap this object for English and the whole UI switches. Client
   CONTENT lives in profile.ts, not here. */
export const t = {
  /* Section titles, keyed by section id (used in the nav sub-lists and the
     section headings). Category NAMES live in profile.ts (categories[].label). */
  sections: {
    plattform: 'Plattform',
    tonalitet: 'Tonalitet',
    logos: 'Logotyper',
    colors: 'Färger',
    typography: 'Typografi',
    imagery: 'Bildspråk',
    motion: 'Rörligt',
    downloads: 'Nedladdningar',
  } as Record<string, string>,
  actions: {
    download: 'Ladda ner',
    downloadAll: 'Ladda ner allt (ZIP)',
    downloadPdf: 'Spara som PDF',
    copy: 'Kopiera',
    copied: 'Kopierat',
    menu: 'Meny',
    close: 'Stäng',
    play: 'Spela',
  },
  tokens: {
    label: 'Hämta som kod',
    hint: 'Färger och typsnitt som design-tokens — klistra in i kodbasen.',
    copied: 'Kopierat',
  },
  contrast: {
    onPaper: 'som text på papper',
    bestText: 'läsbar text',
    aa: 'AA',
    aaa: 'AAA',
    fail: 'låg',
    dark: 'mörk',
    light: 'ljus',
    ratio: 'kontrast',
  },
  search: {
    open: 'Sök',
    placeholder: 'Sök i varumärket…',
    empty: 'Inga träffar',
    hint: 'Hoppa till en sektion eller ett värde',
  },
  changelog: {
    toggle: 'Se ändringar',
    title: 'Ändringshistorik',
    empty: 'Inga ändringar loggade ännu.',
  },
  locked: {
    hint: 'Ingår inte ännu',              // shown on greyed teaser categories
    aria: 'Låst kategori — ingår inte i den här profilen ännu',
  },
  meta: {
    updated: 'Uppdaterad',
    madeBy: 'Skapad av Oh My',
  },
} as const;
