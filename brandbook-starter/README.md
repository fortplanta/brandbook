# Brandbook Starter

A neutral, dependency-light **digital brandbook** — one deployment per client. After a branding job, drop the client's assets in, publish, and send them a single link. They share it internally; everyone works from the same source instead of emailing a PDF or a zip of folders. Built on the same Astro + native-motion foundation as the marketing starter.

Website-first, not PDF-first: the page is the product, per-asset downloads are the daily action, and "Spara som PDF" is a clean print-stylesheet convenience. Unlike a PDF, it plays motion.

## How it works

Everything the book shows comes from **one file**: `src/content/profile.ts`. To make a new client's book:

1. Replace the values in `profile.ts` (client name, `platform`, `tone`, colours, typefaces, logos, downloads, motion).
2. Drop their files into `public/assets/…` and point the paths at them.
3. Set `accent` to the client's brand colour — it's used *only inside content* (active nav dot, swatch focus), never on the neutral chrome.
4. `npm run build`, deploy the static `dist/` anywhere.

By default the **whole template structure shows** — all 28 sections — and a section without content renders as a placeholder describing what belongs there. Per client you choose what's shown (`visibility`, `hideEmpty` — see below), so the same template fits a one-page identity or a sprawling system, handled by data, not by editing layout.

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
- `src/content/categories.ts` — the template structure (categories + numbered sections), kept in the repo because it's agency structure, not per-client content.

Because content is pulled at **build time**, the CMS is never a runtime dependency: a published book is static and keeps serving even if the CMS is offline. Publishing in the CMS triggers a rebuild of that one client's site (a deploy webhook). Full setup, the per-client editor roles, and the SQLite-now / Postgres-later path are in `brandbook-cms/README.md`.

## Structure: categories, sections & what shows

The template is one fixed structure — 5 categories, 28 numbered sections — defined in `src/content/categories.ts` (names, numbers, order and the placeholder copy for each):

```
I.   Varumärkesplattform    1–9    Introduktion … Målgrupper / personas
II.  Visuell identitet     10–17   Logotyp, Färgpalett, Typografi, … Illustrationsmanér
III. Rörligt & ljud        18–20   Rörlig identitet, Video-guidelines, Ljud-ID
IV.  Tillämpning           21–25   Digitala/Print-applikationer, Co-branding, Merch, Exempel
V.   Resurser & governance 26–28   Nedladdningsbara assets, Kontakt & godkännande, Versionshistorik
```

Section headings carry the number and category ("10 — Visuell identitet"); the side nav groups them into collapsible categories (an accordion).

**What shows is granular, per client** (in `profile.ts`):

- **Default** — every section renders. One with content uses its component; one without renders a **placeholder** ("Innehåll saknas" + what belongs there).
- **`visibility`** — keyed by a section *or* category id:
  - `'hidden'` → gone from the page and the nav.
  - `'locked'` → **greyed out and non-clickable** in the nav (not on the page) with an "Ingår inte ännu" hint. A deliberate soft upsell: the client sees the shape of what a fuller engagement would add without it being sold aggressively.
- **`hideEmpty: true`** — drop every section without content (no placeholders) for a finished, client-facing book.

```ts
visibility: { 'ljud-id': 'hidden', tillampning: 'locked' },
hideEmpty: true,
```

## Sections

Each section has its own component in `src/components/sections/`. Built so far: Positionering (`Platform`), Tonalitet & röst (`Tone` — principles with do/don't and a copyable boilerplate), Logotyp (`LogotypesSection`), Färgpalett (`Colors` — click HEX to copy), Typografi (live specimens), Bildspråk / fotostil (`Imagery`), Rörlig identitet (`Motion` — native `<video>`), Nedladdningsbara assets (`Downloads`, incl. a pre-built "Ladda ner allt" ZIP) and Versionshistorik (renders `changelog`). The rest are stubs that render the placeholder until they're built — build one by replacing its stub, and add its content check to `has` in `pages/index.astro`.

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
  content/categories.ts       the template structure: 5 categories, 28 numbered sections
  content/profile.ts          the content model + per-client visibility + sample client (the file you edit)
  lib/strings.ts              UI copy (Swedish default)
  layouts/BrandbookLayout.astro
  components/SideNav.astro     the category accordion (shown / hidden / locked)
  components/SectionHead.astro numbered section heading ("10 — Visuell identitet")
  components/sections/         one component per section; unbuilt ones render Placeholder.astro
  pages/index.astro           resolves visibility, builds the nav, renders sections in order
  scripts/enhance.ts          active-nav, category accordion, copy, print, mobile menu
  styles/global.css           neutral chrome + section styles + print stylesheet
public/assets/                logos / fonts / imagery / motion / templates + the download-all ZIP
```

The sample ships a placeholder profile ("Nordö") with generated placeholder assets so it renders immediately — replace them with the real client.
