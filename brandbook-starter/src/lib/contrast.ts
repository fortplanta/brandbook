/* ============================================================================
   WCAG CONTRAST — computed at build time so the swatches ship with legibility
   guidance and no runtime cost. Standard sRGB relative-luminance math (WCAG 2.1).
   ========================================================================== */
import type { Color } from '../content/profile';

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type Rating = 'AAA' | 'AA' | 'low';
/** Normal-text thresholds: AA ≥ 4.5, AAA ≥ 7. */
export function rate(ratio: number): Rating {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'low';
}

const DARK_TEXT = '#111113';
const LIGHT_TEXT = '#ffffff';

export interface SwatchContrast {
  onPaper: { ratio: number; rating: Rating };   // this colour as TEXT on the paper background
  bestText: { color: 'dark' | 'light'; ratio: number; rating: Rating }; // best TEXT colour ON this swatch
}

/** Pick the paper/background reference from the palette (role-tagged, else lightest, else white). */
export function paperReference(colors: Color[]): string {
  const tagged = colors.find((c) => /bakgrund|papper|paper|\bbg\b/i.test(`${c.role ?? ''} ${c.name}`));
  if (tagged) return tagged.hex;
  if (!colors.length) return '#ffffff';
  return colors.reduce((a, b) => (luminance(b.hex) > luminance(a.hex) ? b : a)).hex;
}

export function swatchContrast(hex: string, paper: string): SwatchContrast {
  const onPaperRatio = contrastRatio(hex, paper);
  const dark = contrastRatio(hex, DARK_TEXT);
  const light = contrastRatio(hex, LIGHT_TEXT);
  const useDark = dark >= light;
  const bestRatio = useDark ? dark : light;
  return {
    onPaper: { ratio: onPaperRatio, rating: rate(onPaperRatio) },
    bestText: { color: useDark ? 'dark' : 'light', ratio: bestRatio, rating: rate(bestRatio) },
  };
}

export const fmtRatio = (r: number): string => `${r.toFixed(1)}:1`;
