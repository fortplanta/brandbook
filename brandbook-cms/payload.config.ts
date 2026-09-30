import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig, addDataAndFileToRequest } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

import { Users } from './src/collections/Users'
import { Clients } from './src/collections/Clients'
import { Media } from './src/collections/Media'
import { analyzeImage, analyzeFrames, warmUp } from './src/ingest/vision.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/* Self-hosted, single box. SQLite by default — one file (brandbook.db), trivial
   to back up, no DB server to run. For heavier use swap `sqliteAdapter` for
   `postgresAdapter` (one line); nothing else changes. */
export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname, 'src') },
  },
  collections: [Clients, Media, Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: sqliteAdapter({
    client: { url: process.env.DATABASE_URI || `file:${path.resolve(dirname, 'brandbook.db')}` },
    push: true, // dev: auto-sync schema. For production, generate + run migrations instead.
  }),
  sharp,
  /* Ingest image analysis — local, open-source (see src/ingest/vision.js).
     POST /api/ingest/vision  { image: dataURL (a downscaled copy), palette: [{name,hex}] }
                              or { images: dataURL[] } — frames of one video, judged together
     GET  /api/ingest/vision/warm  loads the model ahead of the first drop. */
  endpoints: [
    {
      path: '/ingest/vision',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Not signed in' }, { status: 401 })
        await addDataAndFileToRequest(req)
        const { image, images, palette } = (req.data || {}) as { image?: string; images?: string[]; palette?: { name: string; hex: string }[] }
        const decode = (u: unknown): Buffer | null => { const m = typeof u === 'string' && u.match(/^data:image\/[a-z+]+;base64,(.+)$/); return m ? Buffer.from(m[1], 'base64') : null }
        const pal = Array.isArray(palette) ? palette : []
        const frames: Buffer[] = Array.isArray(images) ? images.flatMap((u) => { const b = decode(u); return b ? [b] : [] }).slice(0, 8) : []
        const single = decode(image)
        if (!single && !frames.length) return Response.json({ error: 'Expected { image } or { images }' }, { status: 400 })
        try {
          return Response.json(frames.length ? await analyzeFrames({ buffers: frames, palette: pal }) : await analyzeImage({ buffer: single!, palette: pal }))
        } catch (e: any) {
          req.payload.logger.error(`ingest/vision: ${e?.message || e}`)
          return Response.json({ error: 'Analysis failed' }, { status: 500 })
        }
      },
    },
    {
      path: '/ingest/vision/warm',
      method: 'get',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Not signed in' }, { status: 401 })
        await warmUp()
        return Response.json({ ready: true })
      },
    },
  ],
  // The Astro build reads these over REST; allow it to fetch during build.
  cors: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
})
