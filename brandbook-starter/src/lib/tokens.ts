/* ============================================================================
   DESIGN TOKENS — build-time export of the profile's colours + typography as
   CSS custom properties, JSON, and a Tailwind theme.extend snippet. Pure data
   transform, runs in Astro at build; the page ships the finished strings and a
   copy button, so there's no runtime generation and no dependency.
   ========================================================================== */
import type { Color, Typeface } from '../content/profile';

/** ascii-safe key from a Swedish label: "Papper" → "papper", "Röd" → "rod". */
export function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[åäàá]/g, 'a')
    .replace(/[öø]/g, 'o')
    .replace(/[éèê]/g, 'e')
    .replace(/[ü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** de-duplicate keys so two colours named the same still export distinctly. */
function uniqueKeys(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const base = slug(n) || 'token';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  });
}

/** font key prefers the role ("Display"→display), falls back to the name. */
function fontKeys(faces: Typeface[]): string[] {
  return uniqueKeys(faces.map((f) => f.role || f.name));
}

export interface TokenBundle { css: string; json: string; tailwind: string; }

export function buildTokens(colors: Color[], typography: Typeface[]): TokenBundle {
  const colorKeys = uniqueKeys(colors.map((c) => c.name));
  const faceKeys = fontKeys(typography);

  /* ---- CSS custom properties ---- */
  const cssLines = [
    ':root {',
    ...colors.map((c, i) => `  --color-${colorKeys[i]}: ${c.hex};`),
    ...(typography.length ? [''] : []),
    ...typography.map((f, i) => `  --font-${faceKeys[i]}: ${f.stack};`),
    '}',
  ];
  const css = cssLines.join('\n');

  /* ---- JSON ---- */
  const jsonObj = {
    color: Object.fromEntries(colors.map((c, i) => [colorKeys[i], c.hex])),
    font: Object.fromEntries(typography.map((f, i) => [faceKeys[i], f.stack])),
  };
  const json = JSON.stringify(jsonObj, null, 2);

  /* ---- Tailwind theme.extend ---- */
  const stackToArray = (stack: string) =>
    '[' + stack.split(',').map((s) => `'${s.trim().replace(/'/g, "\\'")}'`).join(', ') + ']';
  const twLines = [
    '// tailwind.config.js — merge into theme.extend',
    'export default {',
    '  theme: {',
    '    extend: {',
    '      colors: {',
    ...colors.map((c, i) => `        ${colorKeys[i]}: '${c.hex}',`),
    '      },',
    '      fontFamily: {',
    ...typography.map((f, i) => `        ${faceKeys[i]}: ${stackToArray(f.stack)},`),
    '      },',
    '    },',
    '  },',
    '};',
  ];
  const tailwind = twLines.join('\n');

  return { css, json, tailwind };
}
