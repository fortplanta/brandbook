# Brandbook CMS

Self-hosted content backend for the brandbook starter. **Payload**, chosen because it fits the exact constraints: non-technical editors, per-client access, self-hosted on your own server, and free forever (MIT — no seats, no paid RBAC tier, no revenue cap).

The brandbook sites stay **static Astro builds**. This CMS is a *build-time* dependency, not a runtime one — if this box is down for patching, every already-published client book keeps serving. Publishing just triggers a rebuild.

## What's here

```
payload.config.ts        Payload config (SQLite by default)
src/collections/
  Clients.ts             one document = one client brandbook; fields mirror the
                         Astro `Profile` type one-to-one
  Media.ts               uploads: logos, fonts, imagery, the ZIP, video
  Users.ts               agency editors — role + assigned clients
src/access/index.ts      the access rules (the whole reason for a roles CMS)
src/ingest/              the smart drop-zone engine + apply logic (see below)
src/admin/IngestPanel.tsx  the drop zone mounted on the Clients edit view
seed.ts                  creates an admin, a Tangent editor, and the Tangent book
serve.ts                 optional read-only REST for builds (no Next needed)
src/app/(payload)/…      standard Payload 3 admin (Next.js app router)
```

## Smart ingest — the main way you fill a book

At the top of every client's edit view there's a **drop zone**. Drag files from
disk, or paste (⌘V) — hex codes, SVGs, fonts, images, video, zips, CSS/JSON token
dumps. The engine (`src/ingest/classify.js`) detects what each thing is and routes
it to the matching field: colours, logos, typography, imagery, motion, downloads.
Prose it never guesses — it holds a pasted paragraph in a "needs your choice" tray
for you to place (tagline / platform / boilerplate / cover note).

You review the detected list, re-route anything with a dropdown, edit colour names,
then hit **Apply**. Apply uploads each file to the `media` collection and saves the
client **as a draft** — nothing goes live until you press *Publish*. Same engine as
the standalone prototype (`ingest-prototype.html`) and the future Figma marquee
plugin; only the "apply" end is real here.

Verified end to end in the real admin: the panel mounts on the Clients edit view,
a browser file upload reaches `media`, colours/logos/tagline populate as a draft,
and the published version stays untouched until Publish. Details and the tested
routing rules are in `src/ingest/README.md`.

## The access model (the point of all this)

Two roles, in `src/access/index.ts`:

- **admin** — agency leads. See and edit every client.
- **editor** — designers, PMs. See and edit **only** the clients listed on their user record (`clients` relationship). No code, no Git, no terminal — they log in and edit fields.

Clients (the brands) are **viewers**, never users here. Public/anonymous reads (the site build) return **published** documents only, so drafts never leak. Per-client scoping is a plain function — it costs nothing and isn't behind a paid tier.

## Run it (SQLite — zero DB server)

```bash
cp .env.example .env          # set PAYLOAD_SECRET to something long and random
pnpm install
pnpm seed                     # creates the DB, the Tangent book, an admin + editor
pnpm dev                      # admin at http://localhost:3000/admin
```

Seed logins (change immediately): `admin@fokusnordic.se` / the password from `.env`, and `editor@fokusnordic.se` scoped to Tangent only.

Content is one file, `brandbook.db` — back it up by copying it. Uploaded assets live in `./media`.

## Connect it to the site build

In the Astro starter (`brandbook-starter`), set two env vars and build:

```bash
PAYLOAD_URL=https://cms.yourdomain.se CLIENT_SLUG=tangent npm run build
```

The build fetches `GET /api/clients?where[slug][equals]=tangent&depth=2`, maps it to the `Profile` shape, and renders — nothing else in the site changes. With no `PAYLOAD_URL`, the site falls back to its local `profile.ts`. (See the starter's README, "Hooking up the CMS".)

**Publish → rebuild:** add an `afterChange` hook on `Clients` (or a Payload webhook) that pings your host's deploy hook for that client. One client publishes → that one site rebuilds.

**Optional, no Next:** `pnpm serve:rest` exposes read-only `/api/clients` + `/api/media/file/*` from the DB on port 3300 — handy if a build pipeline needs content without running the full admin.

## Going to production

- **Database.** SQLite is genuinely fine for a handful of clients and editors — one file, trivial backup. If you outgrow it, swap `sqliteAdapter` for `postgresAdapter` in `payload.config.ts` (one line) and point `DATABASE_URI` at Postgres. Turn `push` off and use migrations (`payload migrate`).
- **Assets.** Files land on local disk (`./media`). For durability/CDN, add `@payloadcms/storage-s3` (S3/Cloudflare R2) — the `Media` collection doesn't change.
- **Ops reality.** "Free" = no license. You still run a Node process, a database file/server, backups and security updates. That's the trade for a non-technical editing UI. Because the sites are static, this box being down never takes a live book offline — only editing pauses.

## How it maps to the typed contract

The `Clients` collection fields are the `Profile` interface from `brandbook-starter/src/content/profile.ts`, field for field. The Astro loader (`src/lib/payloadMap.ts` there) does the only translation needed: unwrap uploaded files to absolute URLs and normalise dates. The type is the contract; the CMS just fills it.
