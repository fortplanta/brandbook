// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Tailwind v4 is wired as a Vite plugin (no @astrojs/tailwind integration needed
// in v4 — one less dependency). Everything ships static by default: Astro emits
// zero client JS unless a component explicitly asks for it via a <script> tag.
export default defineConfig({
  site: 'https://example.com',
  vite: {
    plugins: [tailwindcss()],
  },
});
