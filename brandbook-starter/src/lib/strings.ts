/* UI strings — all chrome copy in one place. Swedish by default (matches the
   Oh My brief); swap this object for English and the whole UI switches. Client
   CONTENT lives in profile.ts, not here. */
import { categories } from '../content/categories';

export const t = {
  /* Section titles, keyed by section id — derived from the template structure
     (src/content/categories.ts), which is the single source for names/order. */
  sections: Object.fromEntries(
    categories.flatMap((c) => c.sections.map((s) => [s.id, s.label]))
  ) as Record<string, string>,
  placeholder: {
    tag: 'Innehåll saknas',               // shown on sections with no content yet
  },
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
    aria: 'Låst — ingår inte i den här profilen ännu',
  },
  meta: {
    updated: 'Uppdaterad',
    madeBy: 'Skapad av Oh My',
  },
} as const;
