# Brandbook Suite

Two apps that work together — deployed to **two different kinds of host**, on purpose.

```
brandbook-starter/   Astro static site — the client-facing brandbook. → Netlify (or any static host)
brandbook-cms/       Payload CMS (Next.js + DB + uploads) — the internal editor. → a persistent host
```

## Why two hosts

The brandbook site is **static**: it builds to plain files and serves from a CDN. Netlify is ideal.

The CMS is a **stateful server**: it needs a writable database and a place to keep uploaded files. Serverless hosts (Netlify, Vercel) have an ephemeral, read-only filesystem at runtime, so the default **SQLite file can't persist and local uploads vanish**. The CMS therefore belongs on a host with a real disk/DB — **Render, Railway, Fly, or a small VPS** — where it can run as a long-lived Node process. (You *can* force it onto Netlify, but only by swapping SQLite for hosted Postgres and uploads for external object storage — which gives up the "one SQLite file you back up by copying" simplicity.)

Because the site is static, the CMS is only a **build-time** dependency of it: publishing in the CMS triggers a rebuild of that client's site. If the CMS is down, every already-published book keeps serving.

## Deploy — static site (Netlify)

The repo root `netlify.toml` already points Netlify at `brandbook-starter`. In Netlify: New site → import this repo → it reads the config. Optional env vars to build a client from the CMS instead of the committed sample:

```
PAYLOAD_URL = https://your-cms-host
CLIENT_SLUG = tangent
```

With neither set, it builds from the sample profile (Tangent) — good for a first "does it click live?" deploy.

## Deploy — CMS (persistent host)

See `brandbook-cms/README.md`. Summary: run it as a Node web service, give it a database (SQLite on a persistent volume, or Postgres via a one-line adapter swap), and point `PAYLOAD_URL` (in the site's build) at its URL. Change the seeded passwords before it faces the internet.

## Local dev

```
cd brandbook-starter && npm install && npm run dev      # http://localhost:4321
cd brandbook-cms     && pnpm install && pnpm seed && pnpm dev   # http://localhost:3000/admin
```
