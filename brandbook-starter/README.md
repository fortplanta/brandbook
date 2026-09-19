# Brandbook Starter

A neutral, dependency-light **digital brandbook** — one deployment per client. After a branding job, drop the client's assets in, publish, and send them a single link. They share it internally; everyone works from the same source instead of emailing a PDF or a zip of folders. Built on the same Astro + native-motion foundation as the marketing starter.

Website-first, not PDF-first: the page is the product, per-asset downloads are the daily action, and "Spara som PDF" is a clean print-stylesheet convenience. Unlike a PDF, it plays motion.

## How it works

Everything the book shows comes from **one file**: `src/content/profile.ts`. To make a new client's book:

1. Replace the values in `profile.ts` (client name, `platform`, `tone`, colours, typefaces, logos, downloads, motion).
2. Drop their files into `public/assets/…` and point the paths at them.
3. Set `accent` to the client's brand colour — it's used *only inside content* (active nav dot, swatch focus), never on the neutral chrome.
4. `npm run build`, deploy the static `dist/` anywhere.

Any section whose array is empty **disappears from the page and the side nav automatically**, so the same template fits a one-page identity or a sprawling system. That's the "scales from small to large" requirement handled by data, not by editing layout.

**CMS handoff:** the CMS just needs to output the `Profile` shape in `profile.ts`. Map its fields to that interface, delete the sample object, and nothing else changes. The types are the contract. A ready-made Payload CMS that does exactly this ships alongside in `brandbook-cms/` — see below.

## Hooking up the CMS

Content comes from one of two places, chosen by env vars — the site is identical either way:

- **No env set** → builds from the local `src/content/profile.ts` (the fallback; good for a quick one-off or offline work).
- **`PAYLOAD_URL` + `CLIENT_SLUG` set** → fetches that client from the self-hosted Payload CMS at build time, maps it to `Profile`, and renders.

```bash
PAYLOAD_URL=https://cms.yourdomain.se CLIENT_SLUG=tangent npm run build
```

The wiring is three small files, and no component changes:

- `src/lib/loadProfile.ts` — the switch: fetch-from-CMS or local file, returns `Profile`.
- `src/lib/payloadMap.ts` — maps one Payload `clients` document to `Profile` (unwraps uploaded files to absolute URLs, normalises dates).
- `src/content/categories.ts` — the sidebar structure, kept in the repo because it's agency structure, not per-client content.

Because content is pulled at **build time**, the CMS is never a runtime dependency: a published book is static and keeps serving even if the CMS is offline. Publishing in the CMS triggers a rebuild of that one client's site (a deploy webhook). Full setup, the per-client editor roles, and the SQLite-now / Postgres-later path are in `brandbook-cms/README.md`.

## Categories & the locked-teaser upsell

The side nav is grouped into collapsible **categories** (an accordion), so a big book reads as a few openable groups instead of a long flat list. Categories are defined once, in the `categories` array in `profile.ts`, and each maps to a set of section ids:

```
Kärnan    → plattform            (the brand's idea / position / values)
Röst      → tonalitet            (tone of voice: principles, do/don't, boilerplate)
Uttryck   → logos, colors, typography, imagery, motion
I bruk    → (locked teaser)
Material  → downloads
```

Each category has **three possible states**, and this is the mechanic that makes one template serve both a tiny client and a full system:

- **Active** — has content; renders normally, opens and closes.
- **Hidden** — omit it (or leave its sections empty) and it vanishes entirely. This is how you ship a *clean, minimal* brandbook for a small client: just colours and a logo, nothing else on screen.
- **Locked** (`locked: true`) — appears **greyed out and non-clickable**, with a small lock and an "Ingår inte ännu" hint. It's a deliberate soft upsell: the client sees the shape of what a fuller engagement would add ("…should we maybe have done more?") without it being sold aggressively. Rename/retheme these freely per pitch.

So the same file expresses "this is all they bought" and "here's what they didn't (yet)" in one place. Category names are meant to be evocative rather than functional — treat them as copy, not labels.

## Sections

Plattform (brand idea/position/values), Tonalitet (tone of voice — principles with do/don't examples and a copyable boilerplate), Logotyper, Färger (click a swatch to copy HEX), Typografi (live specimens), Bildspråk, Rörligt (native `<video>` — the edge over a PDF), Nedladdningar (per-asset + a single "Ladda ner allt" ZIP you pre-build and drop in `public/`).

## For developers & power users

Four features make the book more than a static reference — all client-side, no backend, no added dependencies:

- **Design-token export.** Under the colour grid, "Hämta som kod" copies the palette + typefaces as CSS custom properties, JSON, or a Tailwind `theme.extend` snippet. Generated at build time from `profile.ts` (`src/lib/tokens.ts`), so it's always in sync — a dev pastes real tokens instead of re-typing hexes.
- **WCAG contrast readout.** Each swatch shows two build-time badges: the colour's contrast as text on the paper background (AA/AAA/`låg`), and which text colour (dark or light) is legible *on* that colour. Pure luminance math in `src/lib/contrast.ts` — no runtime cost, no JS. The paper reference is picked from the palette (role-tagged, else the lightest colour).
- **Cmd/Ctrl-K search.** A command palette that indexes sections and key content (colours, typefaces, tone principles, platform blocks) straight from the DOM, so it tracks whatever the profile ships. Fuzzy match, arrow/enter to jump, Esc to close. Progressive enhancement — the "Sök" trigger only appears with JS.
- **Living document (`changelog`).** Optional `changelog: [{ date, note }]` in `profile.ts` renders a "Se ändringar" disclosure in the footer. The page is always the latest version; this makes that visible — the edge over a PDF someone downloaded months ago. Native `<details>`, works without JS.

Two planned items are deliberately **not** built, because they need a backend and would break the "one static deploy per client, no dependencies" model: full versioning/diffing (beyond the changelog) and agency-side view analytics. For analytics, the honest minimal path is a privacy-first snippet (Plausible/Umami) behind a config flag — say the word and I'll wire it as an opt-in.

## Chrome & language

The interface is deliberately quiet — greys only — so the client's profile fills the space. "Skapad av Oh My" sits in the side-nav footer. All UI copy lives in `src/lib/strings.ts`, Swedish by default; swap that one object for English and the whole UI switches. Client content stays in `profile.ts`.

## Getting started

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static output to dist/
```

Dependencies: `astro`, `tailwindcss`, `@tailwindcss/vite`. Client JS is a small first-party enhancement file (`src/scripts/enhance.ts`) covering active-nav tracking, the scroll-driven category accordion, copy-to-clipboard, token export, the Cmd/Ctrl-K palette, print, and the mobile menu — the book is fully readable without it (categories render open, the changelog is a native `<details>`, search is JS-only).

## Project structure

```
src/
  content/profile.ts          the entire content model + categories + sample client (the one file you edit)
  lib/strings.ts              UI copy (Swedish default)
  layouts/BrandbookLayout.astro
  components/SideNav.astro     the category accordion (active / hidden / locked)
  components/sections/         Cover, Platform, Tone, Logos, Colors, Typography, Imagery, Motion, Downloads
  pages/index.astro           assembles present sections + builds the nav + categories
  scripts/enhance.ts          active-nav, category accordion, copy, print, mobile menu
  styles/global.css           neutral chrome + section styles + print stylesheet
public/assets/                logos / fonts / imagery / motion / templates + the download-all ZIP
```

The sample ships a placeholder profile ("Nordö") with generated placeholder assets so it renders immediately — replace them with the real client.
