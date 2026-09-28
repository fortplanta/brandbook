/* ============================================================================
   COLOUR UTILITIES for the colour guide — all build time. Resolve palette
   references (name or hex), generate tint scales, and derive the "wrong"
   colours the misuse examples need, from the client's own palette.
   ========================================================================== */
import type { Color } from '../content/profile';
import { contrastRatio } from './contrast';

const toRgb = (hex: string): [number, number, number] => {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: number[]): string =>
  '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** A palette reference — a colour's name (case-insensitive) or a raw hex. */
export function resolveColor(ref: string, colors: Color[]): Color {
  const hit = colors.find((c) => c.name.toLowerCase() === ref.toLowerCase());
  if (hit) return hit;
  return { name: ref, hex: /^#/.test(ref) ? ref : '#888888' };
}

/** Linear sRGB-space mix: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const [ra, ga, ba] = toRgb(a), [rb, gb, bb] = toRgb(b);
  return toHex([ra + (rb - ra) * t, ga + (gb - ga) * t, ba + (bb - ba) * t]);
}

/** A 50–900 scale around a base colour (500 = the colour itself). */
export function tintScale(hex: string): { step: number; hex: string }[] {
  const light = [[50, 0.92], [100, 0.84], [200, 0.68], [300, 0.5], [400, 0.28]] as const;
  const dark = [[600, 0.2], [700, 0.38], [800, 0.56], [900, 0.72]] as const;
  return [
    ...light.map(([step, t]) => ({ step, hex: mix(hex, '#FFFFFF', t) })),
    { step: 500, hex: hex.toUpperCase() },
    ...dark.map(([step, t]) => ({ step, hex: mix(hex, '#000000', t) })),
  ];
}

/** Rotate a colour's hue (HSL), keeping lightness/saturation — an off-brand twin. */
export function rotateHue(hex: string, deg: number): string {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  h = (((h * 360 + deg) % 360) + 360) % 360 / 360;
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return toHex([l * 255, l * 255, l * 255]);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return toHex([hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255]);
}

/** The palette pair with the lowest contrast that's still visibly two colours (> 1.3:1) — the misuse example. */
export function lowestContrastPair(colors: Color[]): [Color, Color] {
  let best: [Color, Color] = [colors[0], colors[1] ?? colors[0]];
  let min = Infinity;
  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++) {
      const r = contrastRatio(colors[i].hex, colors[j].hex);
      if (r < min && r > 1.3) { min = r; best = [colors[i], colors[j]]; }   // poor, but still visibly two colours
    }
  return best;
}

/** Readable text colour for a swatch: near-black or white, whichever contrasts more. */
export const readableOn = (hex: string): string =>
  contrastRatio(hex, '#111113') >= contrastRatio(hex, '#FFFFFF') ? '#111113' : '#FFFFFF';
